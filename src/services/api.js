import axios from 'axios';

// 判断当前环境
const isDevelopment = import.meta.env.DEV;

// 会话ID存储
let currentJSESSIONID = '';

// 从Home Assistant配置中获取用户凭据
const getCredentialsFromConfig = () => {
    try {
        // 首先尝试从全局配置中获取（适用于卡片模式）
        if (window.haCard && window.haCard.config) {
            const config = window.haCard.config;
            if (config.username && config.password) {
                return {
                    username: config.username,
                    password: config.password, // 配置中的密码假设已经是明文，接口中会进行MD5加密
                };
            }
        }

        // 然后尝试从本地存储中获取（适用于panel_custom模式）
        const storedConfig = localStorage.getItem('aecc_config');
        if (storedConfig) {
            const config = JSON.parse(storedConfig);
            console.log('从本地存储中获取凭据:', config)
            return {
                username: config.username || '',
                password: config.password || '', // localStorage中的密码已经是MD5加密后的
            };
        }

        // // 尝试从URL参数获取（开发调试用）
        // const urlParams = new URLSearchParams(window.location.search);
        // const urlUsername = urlParams.get('username');
        // const urlPassword = urlParams.get('password');
        //
        // if (urlUsername && urlPassword) {
        //   // 存储到本地存储以便后续使用，URL参数中的密码为明文，需要MD5加密
        //   localStorage.setItem('aecc_config', JSON.stringify({
        //     username: urlUsername,
        //     password: urlPassword,
        //   }));
        //
        //   return {
        //     username: urlUsername,
        //     password: urlPassword, // URL中的密码是明文，接口中会进行MD5加密
        //   };
        // }
    } catch (error) {
        console.error('获取凭据时出错:', error);
    }

    // 如果都找不到，返回空值
    return { username: '', password: '' };
};

// 获取Home Assistant系统语言
const getHaLanguage = () => {
    // 尝试从localStorage获取语言设置
    const haLanguage = localStorage.getItem('language');
    if (haLanguage) {
        return haLanguage;
    }

    // 尝试从浏览器语言获取
    const browserLanguage = navigator.language || navigator.userLanguage;
    if (browserLanguage) {
        // 使用完整的语言代码，如 'zh-CN', 'en-US'
        return browserLanguage;
    }
    // 默认返回英语
    return 'en-US';
};

// 动态确定baseURL
const getBaseUrl = () => {
    // 从配置中获取API URL
    const credentials = getCredentialsFromConfig();
    if (credentials.api_url) {
        return credentials.api_url;
    }

    // 开发环境使用代理
    if (isDevelopment) {
        return '/api';
    }

    // 生产环境(Home Assistant中)
    // 尝试自动检测当前域名
    if (typeof window !== 'undefined') {
        // 在HA环境中可以获取supervisor主机
        const isHass = window.location.href.includes('hassio') ||
            window.location.href.includes('supervisor');

        if (isHass) {
            // 使用supervisor API
            return 'http://supervisor/core/api/hassio_ingress/xxx';
        }
    }

    // 默认直接连接目标服务器 - 需要服务器支持CORS
    // 本地调试
    // if (isDevelopment) {
    //   return 'http://192.168.3.7';
    // }
    // 生产环境
    return 'https://monitor.ai-ec.cloud:8443';
};

// 创建axios实例 - 根据环境使用不同的baseURL
const api = axios.create({
    baseURL: getBaseUrl(),
    timeout: 10000,
    headers: {
        'Content-Type': 'application/json',
        'Accept-Language': getHaLanguage(), // 添加语言支持
    },
    withCredentials: true // 允许跨域请求携带cookie
});

// 获取当前浏览器中的所有cookie
const getCookies = () => {
    const cookies = document.cookie.split(';').reduce((cookieObj, cookie) => {
        const [name, value] = cookie.trim().split('=');
        cookieObj[name] = value;
        return cookieObj;
    }, {});
    return cookies;
};

// 从cookie字符串中提取JSESSIONID
const extractJSESSIONID = (cookieStr) => {
    if (!cookieStr) return null;
    const match = cookieStr.match(/JSESSIONID=([^;]+)/);
    return match ? match[1] : null;
};

// 请求拦截器
api.interceptors.request.use(
    config => {
        // 对于params类型参数的POST请求，修改Content-Type
        if (config.method === 'post' && config.params) {
            config.headers['Content-Type'] = 'application/x-www-form-urlencoded';
        }

        // 如果有当前会话ID，手动添加到请求中
        if (currentJSESSIONID) {
            config.headers['Cookie'] = `JSESSIONID=${currentJSESSIONID}; Path=/; SameSite=None;Secure; HttpOnly`;

            config.headers['Same-Site'] = 'None';
            config.headers['Secure'] = true;
            console.log('使用保存的JSESSIONID:', currentJSESSIONID);
        } else {
            // 尝试从当前浏览器cookie中获取
            const cookies = getCookies();
            if (cookies.JSESSIONID) {
                currentJSESSIONID = cookies.JSESSIONID;
                // 配置same-site
                config.headers['Cookie'] = `JSESSIONID=${currentJSESSIONID}; Path=/; SameSite=None;Secure; HttpOnly`;
                // console.log('从浏览器cookie获取JSESSIONID:', currentJSESSIONID);
            }
        }

        // 添加语言支持到请求头
        config.headers['Accept-Language'] = getHaLanguage();

        // 在生产环境添加额外的认证头
        if (!isDevelopment) {
            // 可以添加token等认证信息
            // config.headers['Authorization'] = `Bearer ${localStorage.getItem('token')}`;
        }
        config.withCredentials = true;  // 全局生效
        console.log('发送请求:', config.url, '请求头:', JSON.stringify(config.headers));
        return config;
    },
    error => {
        return Promise.reject(error);
    }
);

// 响应拦截器
api.interceptors.response.use(
    response => {
        console.log('接收到响应:', response.config.url, '响应头:', JSON.stringify(response.headers));
        const { data } = response;

        // 检查响应格式是否符合预期
        if (data === undefined) {
            return Promise.reject(new Error('响应数据格式错误'));
        }

        // 检查业务状态码
        if (data.result !== 0) {
            // 业务逻辑错误
            const error = new Error(data.msg || '操作失败');
            error.code = data.result;
            return Promise.reject(error);
        }

        // 正常响应，返回业务数据
        return data.obj;
    },
    error => {
        // 处理网络错误、超时等
        const message = error.response?.data?.msg || error.message || '网络请求失败';
        return Promise.reject(new Error(message));
    }
);

// 登录接口
export const login = async (username, password) => {
    try {
        // 如果未提供username和password，尝试从配置中获取
        const credentials = getCredentialsFromConfig();
        // console.log(credentials)
        const loginUsername = username || credentials.username;
        let loginPassword = password || credentials.password;

        // 验证凭据是否存在
        if (!loginUsername || !loginPassword) {
            throw new Error('未配置用户名和密码，请在Home Assistant配置中添加username和password');
        }

        // 对非加密密码进行MD5加密，如果密码长度不是32位或不符合MD5格式
        if (loginPassword.length !== 32 || !/^[a-f0-9]{32}$/i.test(loginPassword)) {
            // 确保md5函数可用
            if (typeof window.md5 === 'function') {
                loginPassword = window.md5(loginPassword);
            } else if (typeof md5 === 'function') {
                loginPassword = md5(loginPassword);
            } else {
                console.warn('没有找到md5函数，无法加密密码！');
            }
        }

        // 登录前清除之前的会话ID
        currentJSESSIONID = '';

        const response = await api.post('/user/login', {
            email: loginUsername, // API接口仍然使用email字段，但我们在配置中使用username
            password: loginPassword,
            phoneOs: 1,
            phoneModel: "1.1",
            appVersion: "V1.1"
        });
        // console.log('登录响应:', response);

        // 尝试从响应中获取新的JSESSIONID
        if (response) {
            const setCookieHeader = response.headers && response.headers['set-cookie'];
            if (setCookieHeader) {
                const newJSESSIONID = extractJSESSIONID(setCookieHeader.toString());
                if (newJSESSIONID) {
                    currentJSESSIONID = newJSESSIONID;
                    // console.log('登录获取新JSESSIONID:', currentJSESSIONID);
                }
            }

            // 登录成功，启动会话续期定时器
            startSessionRenewal();

            // 如果没有从响应头获取到，尝试从cookie获取
            if (!currentJSESSIONID) {
                const cookies = getCookies();
                if (cookies.JSESSIONID) {
                    currentJSESSIONID = cookies.JSESSIONID;
                    // console.log('从cookie获取登录后JSESSIONID:', currentJSESSIONID);
                }
            }
            return response;
        }
    } catch (error) {
        console.error('登录失败:', error);
        throw error;
    }
};

// 会话续期
const renewSession = async () => {
    try {
        // 从配置中获取凭据
        const credentials = getCredentialsFromConfig();

        // 验证凭据是否存在
        if (!credentials.username || !credentials.password) {
            console.error('未配置用户名和密码，无法进行会话续期');
            return;
        }

        // 确保密码是MD5加密的
        let password = credentials.password;
        if (password.length !== 32 || !/^[a-f0-9]{32}$/i.test(password)) {
            if (typeof window.md5 === 'function') {
                password = window.md5(password);
            } else if (typeof md5 === 'function') {
                password = md5(password);
            }
        }

        const response = await api.post('/user/login', {
            email: credentials.username, // API接口仍然使用email字段，但我们在配置中使用username
            password: password,
            phoneOs: 1,
            phoneModel: "1.1",
            appVersion: "V1.1"
        });
        // console.log('会话续期响应:', response);
    } catch (error) {
        console.error('会话续期失败:', error);
    }
};

// 启动会话续期定时器
let sessionRenewalTimer = null;
const startSessionRenewal = () => {
    // 清除已存在的定时器
    if (sessionRenewalTimer) {
        clearInterval(sessionRenewalTimer);
    }

    // 每6小时续期一次
    sessionRenewalTimer = setInterval(() => {
        renewSession();
    }, 6 * 60 * 60 * 1000);

    // 立即执行一次续期
    // renewSession();
};

// 停止会话续期
export const stopSessionRenewal = () => {
    if (sessionRenewalTimer) {
        clearInterval(sessionRenewalTimer);
        sessionRenewalTimer = null;
    }
};


// 获取能源流向数据   主页数据
export const getEnergyFlowData = async (plantId) => {
    try {
        // 如果没有提供plantId，尝试从配置中获取
        const credentials = getCredentialsFromConfig();
        const targetPlantId = plantId || credentials.plant_id;

        // 使用params方式传递参数
        return await api.post('/energy/getHomeCountData', null, {
            params: { plantId: targetPlantId }
        });
    } catch (error) {
        console.error('获取能源流向数据失败:', error);
        throw error;
    }
};

// 获取功率数据 渲染功率曲线图
export const getStatusNow = async (plantId, deviceSn = '') => {
    try {
        // 如果没有提供plantId，尝试从配置中获取
        const credentials = getCredentialsFromConfig();
        const targetPlantId = plantId || credentials.plant_id;

        //当日 yyyy-MM-dd
        const time = new Date().toISOString().split('T')[0];
        const response = await api.post('/energy/getEnergyDataDay', null, {
            params: { plantId: targetPlantId, time, deviceSn }
        });
        // console.log('功率统计图数据:', response);
        return response;
    } catch (error) {
        console.error('功率统计图数据获取失败:', error);
        throw error;
    }
};

// 获取用户下所有电站   GET  /plant/getPlantVos
export const getPlantVos = async () => {
    try {
        const response = await api.get('/plant/getPlantVos');
        // console.log('用户下所有电站:', response);
        return response;
    } catch (error) {
        console.error('获取用户下所有电站失败:', error);
        throw error;
    }
};

// 获取当前电站下所有设备 GET /device/getDeviceAllListByPlantId Query: plantId
export const getDeviceAllListByPlantId = async (plantId) => {
    try {
        const response = await api.get('/device/getDeviceAllListByPlantId', {
            params: { plantId }
        })
        // console.log('当前电站下所有设备:', response);
        return response;
    } catch (error) {
        console.error('获取设备自定义详情信息失败:', error);
        throw error;
    }
}

// 获取设备自定义详情信息 POST /device/getDeviceBySn Query: deviceType,time,deviceSn
export const getDeviceBySn = async (deviceType, deviceSn) => {
    try {
        const time = new Date().toISOString().split('T')[0];
        const response = await api.post('/device/getDeviceBySn', null, {
            params: { deviceType, time, sn: deviceSn }
        })
        // console.log('设备自定义详情信息:', response);
        return response;

    } catch (error) {
        console.error('获取设备自定义详情信息失败:', error);
        throw error;
    }
}
// /aiSystem/getAiSystemByPlantId  get params={plantId}
export const getAiSystemByPlantId = async (plantId) => {
    try {
        const response = await api.get('/aiSystem/getAiSystemByPlantId', {
            params: { plantId }
        })
        // console.log('获取电站AI系统数据:', response);
        return response;
    } catch (error) {
        console.error('获取电站AI系统数据失败:', error);
        throw error;
    }
}

// 设置充电器开关状态
export const setChargerStatus = async (deviceSn, status) => {
    try {
        const response = await api.post('/device/setChargerStatus', null, {
            params: {
                deviceSn,
                status: status ? 1 : 0
            }
        });
        // console.log('设置充电器状态:', response);
        return response;
    } catch (error) {
        console.error('设置充电器状态失败:', error);
        throw error;
    }
};

// 设置负载开关状态
export const setLoadStatus = async (deviceSn, status) => {
    try {
        const response = await api.post('/device/setLoadStatus', null, {
            params: {
                deviceSn,
                status: status ? 1 : 0
            }
        });
        // console.log('设置负载状态:', response);
        return response;
    } catch (error) {
        console.error('设置负载状态失败:', error);
        throw error;
    }
};

export default api;

/**
 * Home Assistant生产环境部署指南
 *
 * 方案一：使用HA的反向代理功能
 * 在configuration.yaml中添加:
 *
 * http:
 *   use_x_forwarded_for: true
 *   trusted_proxies:
 *     - 127.0.0.1
 *     - ::1
 *   cors_allowed_origins:
 *     - https://my.home-assistant.io
 *
 * 然后添加nginx反向代理:
 *
 * nginx_proxy:
 *   - host: api.local
 *     ssl: true
 *     target: http://192.168.3.7
 *
 * 方案二：创建专门的HA插件
 *
 * 创建一个addon，在addon中运行反向代理服务器，
 * 使用hassio supervisor API自动配置ingress，
 * 这样可以完全避免CORS问题
 *
 * 方案三：部署到同源服务器
 *
 * 如果可能，将前端应用部署到与API相同的服务器上，
 * 使用相同的域名和端口，完全避免跨域问题
 */