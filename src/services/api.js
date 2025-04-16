import axios from 'axios';

// 判断当前环境
const isDevelopment = import.meta.env.DEV;

// 会话ID存储
let currentJSESSIONID = '';

// 动态确定baseURL
const getBaseUrl = () => {
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
      config.headers['Cookie'] = `JSESSIONID=${currentJSESSIONID}`;
      console.log('使用保存的JSESSIONID:', currentJSESSIONID);
    } else {
      // 尝试从当前浏览器cookie中获取
      const cookies = getCookies();
      if (cookies.JSESSIONID) {
        currentJSESSIONID = cookies.JSESSIONID;
        config.headers['Cookie'] = `JSESSIONID=${currentJSESSIONID}`;
        // console.log('从浏览器cookie获取JSESSIONID:', currentJSESSIONID);
      }
    }

    // 在生产环境添加额外的认证头
    if (!isDevelopment) {
      // 可以添加token等认证信息
      // config.headers['Authorization'] = `Bearer ${localStorage.getItem('token')}`;
    }

    // console.log('发送请求:', config.url, '请求头:', JSON.stringify(config.headers));
    return config;
  },
  error => {
    return Promise.reject(error);
  }
);

// 响应拦截器
api.interceptors.response.use(
  response => {
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
export const login = async (email, password) => {
  try {
    // 登录前清除之前的会话ID
    currentJSESSIONID = '';

    const response = await api.post('/user/login', {
      email,
      password,
      phoneOs: 1,
      phoneModel: "1.1",
      appVersion: "V1.1"
    });
    console.log('登录响应:', response);

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
    const response = await api.post('/user/renewSession');
    if (response && response.result === 0) {
      console.log('会话续期成功');

      // 尝试更新JSESSIONID
      const setCookieHeader = response.headers && response.headers['set-cookie'];
      if (setCookieHeader) {
        const newJSESSIONID = extractJSESSIONID(setCookieHeader.toString());
        if (newJSESSIONID) {
          currentJSESSIONID = newJSESSIONID;
          console.log('续期更新JSESSIONID:', currentJSESSIONID);
        }
      }
    } else {
      console.error('会话续期失败:', response);
    }
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
export const getEnergyFlowData = async (plantId = 1102) => {
  try {
    // 使用params方式传递参数
    const response = await api.post('/energy/getHomeCountData', null, {
      params: { plantId }
    });
    // console.log('能源流向数据:', response);
    return response;
  } catch (error) {
    console.error('获取能源流向数据失败:', error);
    throw error;
  }
};

// 获取功率数据 渲染功率曲线图
export const getStatusNow = async (plantId = 1102, deviceSn = '') => {
  try {
    //当日 yyyy-MM-dd
    const time = new Date().toISOString().split('T')[0];
    const response = await api.post('/energy/getEnergyDataDay', null, {
      params: { plantId, time, deviceSn }
    });
    // console.log('电池状态数据:', response);
    return response;
  } catch (error) {
    console.error('获取电池状态数据失败:', error);
    throw error;
  }
};

// 获取用户下所有电站   GET  /plant/getPlantVos
export const getPlantVos = async () => {
  try {
    const response = await api.get('/plant/getPlantVos');
    console.log('用户下所有电站:', response);
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
      params: { deviceType, time, deviceSn }
    })
    console.log('设备自定义详情信息:', response);
    return response;

  } catch (error) {
    console.error('获取设备自定义详情信息失败:', error);
    throw error;
  }
}

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