<template>
  <div class="panel">
    <!-- 凭据配置UI -->
    <div v-if="!isAuthenticated" class="credentials-form">
      <h2>AECC - 能源监控</h2>
      <p>请输入您的登录凭据以访问系统</p>
      <form @submit.prevent="handleLogin">
        <div class="form-group">
          <label for="username">用户名:</label>
          <input id="username" type="text" v-model="credentials.username" required placeholder="请输入用户名">
        </div>
        <div class="form-group">
          <label for="password">密码:</label>
          <input id="password" type="password" v-model="credentials.password" required placeholder="请输入密码">
        </div>
        <div class="form-group">
          <label class="checkbox-container">
            <input type="checkbox" v-model="credentials.remember">
            <span class="checkmark"></span>
            记住凭据
          </label>
        </div>
        <button type="submit" class="login-button" :disabled="loading">
          {{ loading ? '登录中...' : '登录' }}
        </button>
        <div v-if="errorMessage" class="error-message">{{ errorMessage }}</div>
      </form>
    </div>

    <!-- 主面板内容 -->
    <template v-else>
      <!-- Plant selection card area -->
      <h2>{{ name }}</h2>
      <div class="plant-selector-card" style="margin-bottom: 16px;">
        <label for="plant-select">Plant:</label>
        <select id="plant-select" v-model="selectedPlantId" @change="onPlantChange">
          <option v-for="plant in plantList" :key="plant.id" :value="plant.id">
            {{ plant.plantName }}
          </option>
        </select>
      </div>

      <!-- AI Green Power Plan Card -->
      <div class="ai-plan-card" style="margin-bottom: 16px;">
        <label>AI Green Plan:</label>
        <div class="ai-plan-value">{{ aiPlanState }}</div>
      </div>

      <div class="content">
        <!-- Energy Flow Chart -->
        <div class="chart-container energy-flow-container">
          <div ref="energyFlowChart" class="chart"></div>
        </div>

        <!-- Statistics Chart -->
        <div class="chart-container" style="padding-bottom: 5% !important;">
          <div ref="statsChart" class="chart"></div>
        </div>

        <!-- Entity Data Accordion Component -->
        <div class="entities-container">
          <h2 class="section-title">Device Details</h2>
          <div v-for="(group, groupIndex) in entityGroups" :key="groupIndex" class="entity-group">
            <div class="group-header" @click="toggleGroup(groupIndex)">
              <span>{{ group.name }}</span>
              <span class="arrow" :class="{ 'expanded': group.expanded }">▼</span>
            </div>
            <div v-if="group.expanded" class="group-content">
              <h3 class="sub-section-title"></h3>
              <div v-for="entity in group.entities" :key="entity.id" class="entity-card">
                <div class="entity-info">
                  <span class="mdi" :class="getEntityIcon(entity.id)"></span>
                  <div class="entity-description">{{ entity.description }}</div>
                </div>
                <div class="entity-value-container">
                  <div class="entity-value">{{ entity.value }}{{ entity.unit }}</div>
                  <!-- 为Load和Charger设备添加开关按钮 -->
                  <div v-if="group.name === 'Load Devices' || group.name === 'Charger Devices'" class="device-switch-container">
                    <button 
                      class="device-switch-button" 
                      :class="{ 'on': entity.switchStatus === 1, 'off': entity.switchStatus === 0 }"
                      @click="group.name === 'Load Devices' ? toggleLoad(entity.value) : toggleCharger(entity.value)"
                    >
                      {{ entity.switchStatus === 1 ? 'ON' : 'OFF' }}
                    </button>
                  </div>
                </div>
              </div>

              <h3 class="sub-section-title">Details</h3>
              <div v-for="(subGroup, subIndex) in group.subGroups" :key="subIndex" class="entity-subgroup">
                <div class="subgroup-header" @click="toggleGroup(groupIndex, subIndex)">
                  <span>{{ subGroup.name }}</span>
                  <span class="arrow" :class="{ 'expanded': subGroup.expanded }">▼</span>
                </div>
                <div v-if="subGroup.expanded" class="subgroup-content">
                  <div v-for="entity in subGroup.entities" :key="entity.id" class="entity-card">
                    <div class="entity-info">
                      <span class="mdi" :class="getEntityIcon(entity.id)"></span>
                      <div class="entity-description">{{ entity.description }}</div>
                    </div>
                    <div class="entity-value">{{ entity.value }}{{ entity.unit }}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Energy Summary Cards -->
        <div class="energy-summary-container">
          <h2 class="section-title">Energy (kWh)</h2>
          <div class="energy-summary-grid">
            <div class="energy-summary-card solar">
              <div class="energy-summary-icon">
                <span class="mdi mdi-solar-power"></span>
              </div>
              <div class="energy-summary-content">
                <div class="energy-summary-title">Solar Energy</div>
                <div class="energy-summary-value">{{ energySummary.solarDayElec.toFixed(2) }}</div>
              </div>
            </div>
            <div class="energy-summary-card grid">
              <div class="energy-summary-icon">
                <span class="mdi mdi-power-plug"></span>
              </div>
              <div class="energy-summary-content">
                <div class="energy-summary-title">Grid Energy</div>
                <div class="energy-summary-value">{{ energySummary.gridDayElec.toFixed(2) }}</div>
              </div>
            </div>
            <div class="energy-summary-card load">
              <div class="energy-summary-icon">
                <span class="mdi mdi-lightning-bolt"></span>
              </div>
              <div class="energy-summary-content">
                <div class="energy-summary-title">Load Energy</div>
                <div class="energy-summary-value">{{ energySummary.loadDayElec.toFixed(2) }}</div>
              </div>
            </div>
            <div class="energy-summary-card battery">
              <div class="energy-summary-icon">
                <span class="mdi mdi-battery"></span>
              </div>
              <div class="energy-summary-content">
                <div class="energy-summary-title">Battery Energy</div>
                <div class="energy-summary-value">{{ energySummary.batteryDayElec.toFixed(2) }}</div>
              </div>
            </div>
            <div class="energy-summary-card grid-buy">
              <div class="energy-summary-icon">
                <span class="mdi mdi-power-plug-outline"></span>
              </div>
              <div class="energy-summary-content">
                <div class="energy-summary-title">Grid Buy</div>
                <div class="energy-summary-value">{{ energySummary.gridBuyDayElec.toFixed(2) }}</div>
              </div>
            </div>
            <div class="energy-summary-card battery-discharge">
              <div class="energy-summary-icon">
                <span class="mdi mdi-battery-charging"></span>
              </div>
              <div class="energy-summary-content">
                <div class="energy-summary-title">Battery Discharge</div>
                <div class="energy-summary-value">{{ energySummary.batteryDischargeDayElec.toFixed(2) }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import {nextTick, onBeforeMount, onBeforeUnmount, onBeforeUpdate, onMounted, onUpdated, ref} from 'vue';
import * as echarts from 'echarts';
import '@mdi/font/css/materialdesignicons.css';
import EnergyFlowCanvas from './energy-flow-canvas';
import md5 from 'js-md5';
import {
  getPlantVos,
  getStatusNow,
  getEnergyFlowData,
  getDeviceBySn,
  login,
  getAiSystemByPlantId,
  setChargerStatus,
  setLoadStatus
} from '../services/api';

// 将md5函数暴露到全局，以便api.js使用
window.md5 = md5;

// 定义props
const props = defineProps({
  hass: {
    type: Object,
    required: true,
    default: () => ({})
  },
  config: {
    type: Object,
    default: () => ({})
  }
});

// 登录状态和凭据
const isAuthenticated = ref(false);
const loading = ref(false);
const errorMessage = ref('');
const credentials = ref({
  username: localStorage.getItem('aecc_username') || '',
  password: localStorage.getItem('aecc_password') || '',
  remember: !!localStorage.getItem('aecc_username')
});

// 处理登录
const handleLogin = async () => {
  try {
    loading.value = true;
    errorMessage.value = '';
    
    // 对密码进行MD5加密
    const encryptedPassword = md5(credentials.value.password);
    
    // 保存凭据到localStorage（如果选择了记住凭据）
    if (credentials.value.remember) {
      localStorage.setItem('aecc_username', credentials.value.username);
      // 存储加密后的密码
      localStorage.setItem('aecc_password', encryptedPassword);
    } else {
      // 如果不记住，清除localStorage但保持会话内存储
      localStorage.removeItem('aecc_username');
      localStorage.removeItem('aecc_password');
    }
    
    // 尝试登录，使用加密后的密码
    await login(credentials.value.username, encryptedPassword);
    
    // 登录成功
    isAuthenticated.value = true;
    
    // 初始化数据
    await initializeData();
  } catch (error) {
    errorMessage.value = error.message || '登录失败，请检查用户名和密码';
    isAuthenticated.value = false;
  } finally {
    loading.value = false;
  }
};

// 检查是否已有凭据
const checkExistingCredentials = async () => {
  // 从localStorage获取凭据
  const storedUsername = localStorage.getItem('aecc_username');
  const storedPassword = localStorage.getItem('aecc_password');
  
  // 如果有存储的凭据，尝试自动登录
  if (storedUsername && storedPassword) {
    try {
      loading.value = true;
      // 检查密码是否已经是MD5加密格式
      let password = storedPassword;
      if (storedPassword.length !== 32 || !/^[a-f0-9]{32}$/i.test(storedPassword)) {
        // 如果不是MD5格式，进行加密并更新localStorage
        password = md5(storedPassword);
        localStorage.setItem('aecc_password', password);
      }
      
      await login(storedUsername, password);
      isAuthenticated.value = true;
      await initializeData();
    } catch (error) {
      console.error('自动登录失败:', error);
      errorMessage.value = '自动登录失败，请重新输入凭据';
      isAuthenticated.value = false;
    } finally {
      loading.value = false;
    }
  }
};

onBeforeMount(() => {
  console.log('[ha-vue-card] 组件即将挂载');
  // 保存配置到全局变量
  if (props.config && typeof window !== 'undefined') {
    window.haCard = {
      config: props.config
    };
    
    // 如果配置中有凭据，则直接尝试初始化
    if (props.config.username && props.config.password) {
      isAuthenticated.value = true;
      initializeData();
    } else {
      // 否则，检查是否有存储的凭据
      checkExistingCredentials();
    }
  } else {
    // 没有配置，检查是否有存储的凭据
    checkExistingCredentials();
  }
});

onMounted(() => {
  // console.log('[ha-vue-card] 组件已挂载');
  console.log('[ha-vue-card] hass对象:', props.hass);
  console.log('[ha-vue-card] config对象:', props.config);
  // 输出所有实体信息
  if (props.hass && props.hass.states) {
    console.log('[ha-vue-card] 所有实体:', Object.entries(props.hass.states).map(([entityId, state]) => ({
      entityId,
      state: state.state,
      attributes: state.attributes
    })));
  }

  // 添加窗口大小变化监听
  window.addEventListener('resize', handleResize);
});

const onPlantChange = async () => {
  // 处理电站选择变化
  console.log('[ha-vue-card] 电站选择变化:', selectedPlantId.value);

  // 重新获取数据流程
  try {
    // 1. 先获取能流图数据（包含设备SN等信息）
    const energyFlowData = await fetchEnergyFlowData();

    // 2. 同步请求所有其他数据
    await Promise.all([
      // 更新图表
      updateCharts(energyFlowData),
      // 更新实体数据
      updateEntityGroups(),
      // 获取AI绿电计划数据
      fetchAiPlanData()
    ]);

    console.log('[ha-vue-card] 电站切换后所有数据更新完成');
  } catch (error) {
    console.error('[ha-vue-card] 电站切换更新数据失败:', error);
  }
};

onBeforeUpdate(() => {
  console.log('[ha-vue-card] 组件即将更新');
});

onUpdated(() => {
  console.log('[ha-vue-card] 组件已更新');
});

onBeforeUnmount(() => {
  console.log('[ha-vue-card] 组件即将卸载');
  // 释放图表实例
  if (statChart) {
    statChart.dispose();
  }
  // 移除窗口大小变化监听
  window.removeEventListener('resize', handleResize);
});

// 初始化数据的完整流程
const initializeData = async () => {
  try {
    console.log('[ha-vue-card] 开始初始化数据...');
    
    // 如果还未验证，则直接返回
    if (!isAuthenticated.value) {
      return;
    }
    
    // 登录，不再传递硬编码的用户名和密码，而是依赖API从配置中获取
    await login();
    // 1. 首先获取电站列表
    await fetchPlantList();

    if (plantList.value.length > 0) {
      // 2. 初始化图表（此时所有数值为0）
      nextTick(() => {
        initCharts();
      });

      // 3. 获取能流图数据（包含设备SN等信息）
      const energyFlowData = await fetchEnergyFlowData();

      // 4. 同步请求所有其他数据
      await Promise.all([
        // 更新图表
        updateCharts(energyFlowData),
        // 更新实体数据
        updateEntityGroups(),
        // 获取AI绿电计划数据
        fetchAiPlanData()
      ]);

      console.log('[ha-vue-card] 所有数据初始化完成');
    } else {
      console.error('[ha-vue-card] 无可用电站');
      showConfigurationHelp();
    }
  } catch (error) {
    console.error('[ha-vue-card] 初始化数据失败:', error);
    // 如果初始化失败，检查是否是认证问题
    if (error.message && (error.message.includes('未配置用户名和密码') || error.message.includes('登录失败'))) {
      isAuthenticated.value = false;
      errorMessage.value = error.message;
    } else {
      showConfigurationHelp();
    }
  }
};

// 显示配置帮助
const showConfigurationHelp = () => {
  // 创建一个错误信息div
  const helpDiv = document.createElement('div');
  helpDiv.className = 'configuration-help';
  helpDiv.innerHTML = `
    <h2>配置错误</h2>
    <p>请确保您在卡片配置中添加了正确的用户名和密码。按照以下步骤配置:</p>
    <ol>
      <li>在Home Assistant的UI中编辑卡片</li>
      <li>添加以下配置参数:</li>
    </ol>
    <pre>
type: 'custom:ha-vue-card'
name: '能源监控'
username: '您的用户名'
password: '您的密码'
    </pre>
    <p>然后保存配置并刷新页面。</p>
    <p><strong>注意:</strong> 您输入的密码将被自动进行MD5加密后发送到服务器，保障您的账户安全。</p>
  `;
  
  // 查找panel元素并添加帮助信息
  const panel = document.querySelector('.panel');
  if (panel) {
    // 清空现有内容
    while (panel.firstChild) {
      panel.removeChild(panel.firstChild);
    }
    panel.appendChild(helpDiv);
  }
};

// 能源总计数据
const energySummary = ref({
  solarDayElec: 0.0,
  gridDayElec: 0.0,
  loadDayElec: 0.0,
  batteryDayElec: 0.0,
  gridBuyDayElec: 0.0,
  batteryDischargeDayElec: 0.0
});

// 获取能流图数据
const fetchEnergyFlowData = async () => {
  try {
    const energyFlowData = await getEnergyFlowData(selectedPlantId.value);
    console.log('[ha-vue-card] 获取能源流向数据:', energyFlowData);

    if (energyFlowData) {
      // 保存设备基本信息
      deviceInfo.value = {
        batSn: energyFlowData.batSn || '',
        batType: energyFlowData.batType || '',
        emSn: energyFlowData.emSn || '',
        emType: energyFlowData.emType || '',
        // 添加loadList和chargerList
        loadList: energyFlowData.loadList || [],
        chargerList: energyFlowData.chargerList || []
      };

      // 保存batSn值，以便后续使用
      currentBatSn.value = energyFlowData.batSn || '';
      console.log("[ha-vue-card] 更新batSn:", currentBatSn.value);

      // 使用真实的能流图数据更新simulatedData
      if (energyFlowData) {
        simulatedData.value = {
          gridPower: energyFlowData.gridPower || '0W',
          solarPower: energyFlowData.solarPower ||'0W',
          batPower: energyFlowData.batPower || '0W',
          loadPower: energyFlowData.loadPower || '0W',
          chargerPower: energyFlowData.chargerPower || '0W',
          smartPower: energyFlowData.smartPower || '0W',
        };
        console.log("[ha-vue-card] 使用真实能流图数据:", simulatedData.value);
      }

      // 更新能源总计数据
      if (energyFlowData) {
        energySummary.value = {
          solarDayElec: energyFlowData.solarDayElec || 0.0,
          gridDayElec: energyFlowData.gridDayElec || 0.0,
          loadDayElec: energyFlowData.loadDayElec || 0.0,
          batteryDayElec: energyFlowData.batteryDayElec || 0.0,
          gridBuyDayElec: energyFlowData.gridDayBuyElec || 0.0,
          batteryDischargeDayElec: energyFlowData.batteryDayDischargerElec || 0.0
        };
        // console.log("[ha-vue-card] 更新能源总计数据:", energySummary.value);
      }

      return energyFlowData;
    }
  } catch (error) {
    console.error('[ha-vue-card] 获取能源流向数据失败:', error);
  }

  return null;
};

const fetchPlantList = async () => {
  try {
    console.log('[ha-vue-card] 正在获取电站列表...');
    // 等待异步调用完成并获取结果
    const response = await getPlantVos();

    // API 返回的电站列表可能在 response 的某个属性中
    // 根据 API 实际返回结构进行调整
    if (response && Array.isArray(response)) {
      plantList.value = response;
    } else if (response && Array.isArray(response.data)) {
      plantList.value = response.data;
    } else {
      console.error('[ha-vue-card] 电站数据格式不正确:', response);
      plantList.value = [];
    }

    // 设置默认选中的电站
    if (plantList.value.length > 0) {
      selectedPlantId.value = plantList.value[3].id;
      console.log('[ha-vue-card] 默认选中电站:', selectedPlantId.value);
    }
  } catch (error) {
    console.error('[ha-vue-card] 获取电站列表失败:', error);
    plantList.value = [];
  }
};

// 定义需要观察的属性
const observedAttributes = ['hass', 'config'];

// 获取观察的属性列表
const getObservedAttributes = () => observedAttributes;
const attributeChangedCallback = (name, oldValue, newValue) => {
  console.log(`[ha-vue-card] 属性${name}已更新:`, oldValue, '->', newValue);
};

const name = ref(props.config.name || 'AECC Energy Management System Dashboard');
const energyFlowChart = ref(null);
const statsChart = ref(null);

// 初始数据默认全部为0
const simulatedData = ref({
  gridPower: 0,
  solarPower: 0,
  batPower: 0,
  loadPower: 0,
  chargerPower: 0,
  smartPower: 0
});
const links = ref([]); // 用于存储能流图的连接线数据
const nodes = ref([]); // 用于存储能流图的节点数据

// 电站相关数据
const plantList = ref([]);
const selectedPlantId = ref('');
const currentBatSn = ref(''); // 存储当前Battery设备序列号
const entityGroups = ref([
  {
    name: 'Sensor Group',
    expanded: false,
    entities: [
      {id: 'sensor.temp_1', description: 'Living Room Temperature', value: '25', unit: '°C'},
      {id: 'sensor.hum_1', description: 'Living Room Humidity', value: '60', unit: '%'}
    ],
    subGroups: [
      {
        name: 'Temperature Sensors',
        expanded: false,
        entities: [
          {id: 'sensor.temp_2', description: 'Bedroom Temperature', value: '24', unit: '°C'},
          {id: 'sensor.temp_3', description: 'Kitchen Temperature', value: '26', unit: '°C'}
        ]
      },
      {
        name: 'Humidity Sensors',
        expanded: false,
        entities: [
          {id: 'sensor.hum_2', description: 'Bedroom Humidity', value: '55', unit: '%'},
          {id: 'sensor.hum_3', description: 'Kitchen Humidity', value: '65', unit: '%'}
        ]
      }
    ]
  },
  {
    name: 'Switch Group',
    expanded: false,
    entities: [
      {id: 'switch.main_1', description: 'Main Switch', value: 'on', unit: ''}
    ],
    subGroups: [
      {
        name: 'Light Switches',
        expanded: false,
        entities: [
          {id: 'switch.light_1', description: 'Living Room Light', value: 'off', unit: ''},
          {id: 'switch.light_2', description: 'Bedroom Light', value: 'on', unit: ''}
        ]
      },
      {
        name: 'Appliance Switches',
        expanded: false,
        entities: [
          {id: 'switch.tv', description: 'TV', value: 'off', unit: ''},
          {id: 'switch.ac', description: 'Air Conditioner', value: 'on', unit: ''}
        ]
      }
    ]
  }
]);

/**
 * 切换实体组或子组的展开状态
 * @param {number} groupIndex - 要切换的实体组索引
 * @param {number|null} subGroupIndex - 要切换的子组索引,为 null 时切换主组
 */
const toggleGroup = (groupIndex, subGroupIndex = null) => {
  if (subGroupIndex === null) {
    entityGroups.value[groupIndex].expanded = !entityGroups.value[groupIndex].expanded;
  } else {
    entityGroups.value[groupIndex].subGroups[subGroupIndex].expanded = !entityGroups.value[groupIndex].subGroups[subGroupIndex].expanded;
  }
};

let energyChart = null;
let statChart = null;

const initCharts = () => {
  // 初始化能流图
  if (energyFlowChart.value) {
    energyChart = new EnergyFlowCanvas(energyFlowChart.value);

    // 确保容器尺寸正确设置
    const containerWidth = energyFlowChart.value.clientWidth;
    const containerHeight = containerWidth * 9 / 10;
    energyFlowChart.value.style.height = `${containerHeight}px`;

    // 初始化时使用全0数据，但不绘制，等待真实数据
    if (energyChart) {
      // 创建初始的节点和连接（全为0值）
      // 在updateCharts中会用真实数据更新
      prepareZeroNodes();
      // prepareZeroLinks();
    }
  }

  // 初始化统计图
  if (statsChart.value) {
    // 确保统计图容器也设置了正确的尺寸
    const containerWidth = statsChart.value.clientWidth;
    const containerHeight = containerWidth * 0.8; // 使用80%的宽高比
    statsChart.value.style.height = `${containerHeight}px`;

    // 使用nextTick确保DOM渲染完成后再初始化ECharts
    nextTick(() => {
      statChart = echarts.init(statsChart.value);
    });
  }
};

// 准备初始化的零值节点
const prepareZeroNodes = () => {
  if (!nodes.value) return;

  const containerWidth = energyFlowChart.value.clientWidth;
  const calculationHeight = containerWidth * 2 / 3;

  const getPositionByName = (name) => {
    let key;
    if (name === 'Grid') key = 'grid';
    else if (name === 'Solar') key = 'solar';
    else if (name === 'Battery') key = 'battery';
    else if (name === 'Home Load') key = 'home';
    else if (name === 'Charger') key = 'charger';
    else if (name === 'Load') key = 'smart';
    else key = name.toLowerCase();

    const positionRatios = {
      'grid': [0.15, 0.42],
      'solar': [0.5, 0.1],
      'battery': [0.5, 0.76],
      'home': [0.85, 0.42],
      'charger': [0.85, 0.1],
      'smart': [0.85, 0.76]
    };

    const ratio = positionRatios[key];
    return ratio ? {
      x: containerWidth * ratio[0],
      y: calculationHeight * ratio[1]
    } : {
      x: containerWidth * 0.5,
      y: calculationHeight * 0.5
    };
  };

  // 所有节点初始化为0功率
  nodes.value = [
    {
      name: 'Grid',
      power: 0,
      value: `0.0 W`,
      ...getPositionByName('Grid'),
      color: '#673AB7',
      icon: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZD0iTTEyIDJ2NC4wM0E4IDggMCAwIDAgNi4wNCAxMkgydjJoNC4wM0E4IDggMCAwIDAgMTIgMTkuOTZWMjRoMnYtNC4wM0E4IDggMCAwIDAgMTkuOTYgMTRIMjR2LTJoLTQuMDNBOCA4IDAgMCAwIDE0IDYuMDRWMmgtMnptLTIgMTBhMiAyIDAgMSAxIDIgMiAyIDIgMCAwIDEtMi0yeiIgZmlsbD0iIzY3M0FCNyIvPjwvc3ZnPg==',
      workMode: 0
    },
    {
      name: 'Solar',
      power: 0,
      value: `0.0 W`,
      ...getPositionByName('Solar'),
      color: '#FF9800',
      icon: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZD0iTTMuNSAxOGgxN3YyaC0xN3YtMnptMTctMTJoMnYxMGgtMlY2em0tNCAzaDJ2N2gtMlY5em0tNCAtM2gydjEwaC0yVjZ6bS00IDZoMnY0aC0ydi00em0tNCAtM2gydjdIM1Y5eiIgZmlsbD0iI0ZGOTgwMCIvPjwvc3ZnPg==',
      workMode: 0
    },
    {
      name: 'Battery',
      power: 0,
      value: `0.0 W`,
      ...getPositionByName('Battery'),
      color: '#00BCD4',
      icon: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZD0iTTE2IDEwSDh2NEgxNnYtNHptLjY3LThIMTVWMGgtNnYySDcuMzNBMS4zMyAxLjMzIDAgMCAwIDYgMy4zM3YxNy4zNGMwIC43My42IDEuMzMgMS4zMyAxLjMzaDkuMzRjLjczIDAgMS4zMy0uNiAxLjMzLTEuMzNWMy4zM0ExLjMzIDEuMzMgMCAwIDAgMTYuNjcgMnoiIGZpbGw9IiMwMEJDRDQiLz48L3N2Zz4=',
      workMode: 0
    },
    {
      name: 'Home Load',
      power: 0,
      value: `Total: 0.0 W`,
      ...getPositionByName('Home Load'),
      color: '#00BCD4',
      icon: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZD0iTTEyIDNMNCAxMHYxMmgxNlYxMGwtOC03em02IDE0aC0zdi01aC02djVINnYtN2w2LTUgNiA1djd6IiBmaWxsPSIjMDBCQ0Q0Ii8+PC9zdmc+',
      workMode: 0
    },
    {
      name: 'Charger',
      power: 0,
      value: `0.0 W`,
      ...getPositionByName('Charger'),
      color: '#4CAF50',
      icon: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZD0iTTEyIDE4SDZWMmgxNHYxNmgtOHptMi01aDJ2LTJoMlY5aC0yVjdoLTJ2MmgtdmwtNC45IDloNi45eiIgZmlsbD0iIzRDQUY1MCIvPjwvc3ZnPg==',
      workMode: 0
    },
    {
      name: 'Load',
      power: 0,
      value: `0.0 W`,
      ...getPositionByName('Load'),
      color: '#FF5722',
      icon: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZD0iTTUgM3YxNmgxNlYzSDV6bTE0IDE0SDdWNWgxMnYxMnptLTctMWgyek0xNSA4aDJ2OGgtMlY4ek0xMSA4aDJ2M2gtMnYtM3ptMCA1aDJ2M2gtMnYtM3pNNyA4aDJ2MkgzVjhoNHY1eiIgZmlsbD0iI0ZGNTcyMiIvPjwvc3ZnPg==',
      workMode: 0
    }
  ];
};

// 准备初始化的零值连接线
const prepareZeroLinks = () => {
  if (!links.value) return;

  // 初始时所有链接的value为0
  links.value = [
    // 没有连接，因为所有功率为0
  ];
};

const handleResize = () => {
  if (energyChart && energyFlowChart.value) {
    const containerWidth = energyFlowChart.value.clientWidth;
    // --- 设置外部容器的视觉高度 (9:10) ---
    const visualHeight = containerWidth * 9 / 10;
    energyFlowChart.value.style.height = `${visualHeight}px`; // 控制外部 div 的高度

    // --- 触发内部 Canvas 使用 2:3 比例调整尺寸 ---
    // energyChart.resize() 将读取容器宽度，并内部计算 2:3 的高度
    energyChart.resize();
  }
  if (statChart && statsChart.value) {
    // 重新计算并设置统计图容器高度
    const containerWidth = statsChart.value.clientWidth;
    const containerHeight = containerWidth * 0.8;
    statsChart.value.style.height = `${containerHeight}px`;

    // 调整ECharts实例大小
    nextTick(() => {
      statChart.resize();
    });
  }
};
const updateCharts = async (energyFlowData) => {
  // 更新能流图，首先尝试获取真实数据
  let realDataReceived = false;
  // let energyFlowData = null;

  try {
    if (energyFlowData) {
      realDataReceived = true;

      // 更新batSn
      if (energyFlowData.batSn) {
        currentBatSn.value = energyFlowData.batSn;
        // console.log("[ha-vue-card] 更新batSn:", currentBatSn.value);
      }

      // 使用真实的能流图数据更新simulatedData
      if (energyFlowData.flowData) {
        simulatedData.value = {
          gridPower: energyFlowData.gridPower || '0W',
          solarPower: energyFlowData.solarPower || '0W',
          batPower: energyFlowData.batPower || '0W',
          loadPower: energyFlowData.loadPower || '0W',
          chargerPower: energyFlowData.chargerPower || '0W',
          smartPower: energyFlowData.smartPower || '0W'
        };
        // console.log("[ha-vue-card] 使用真实能流图数据:", simulatedData.value);
      }
    }
  } catch (error) {
    console.error("[ha-vue-card] 获取能流图数据失败:", error);
  }

  // 更新能流图
  if (energyChart && energyFlowChart.value) {
    // 只有在未接收到真实数据且初次加载时，才使用默认的0数据
    // 如果已经有数据显示，那么保持之前的数据不变，不更新为0
    if (!realDataReceived && !document.hidden) {
      // console.log("[ha-vue-card] 未接收到真实数据，使用当前数据:", simulatedData.value);
    }

    let gridPower = simulatedData.value.gridPower;
    let solarPower = simulatedData.value.solarPower;
    let batPower = simulatedData.value.batPower;
    let loadPower = simulatedData.value.loadPower;
    let chargerPower = simulatedData.value.chargerPower;
    let smartPower = simulatedData.value.smartPower;
    gridPower = Number(gridPower.replace('W', ''));
    solarPower = Number(solarPower.replace('W', ''));
    batPower = Number(batPower.replace('W', ''));
    loadPower = Number(loadPower.replace('W', ''));
    chargerPower = Number(chargerPower.replace('W', ''));
    smartPower = Number(smartPower.replace('W', ''));
    const totalHomeLoad = loadPower + chargerPower + smartPower; // 计算总Load

    const containerWidth = energyFlowChart.value.clientWidth;
    // --- 关键：节点定位计算使用内部 2:3 比例的高度 ---
    const calculationHeight = containerWidth * 2 / 3; // 用于计算内部坐标

    const calculatePosition = (xRatio, yRatio) => {
      return {
        x: containerWidth * xRatio,
        // --- 使用基于 2:3 的高度进行 Y 坐标计算 ---
        y: calculationHeight * yRatio
      };
    };

    // 节点位置比例 (应适用于 2:3 的布局)
    const positionRatios = {
      'grid': [0.15, 0.42],
      'solar': [0.5, 0.1], // 靠近顶部 (在 2:3 空间内)
      'battery': [0.5, 0.76], // 靠近底部 (在 2:3 空间内)
      'home': [0.85, 0.42],
      'charger': [0.85, 0.1], // 稍微调整以适应 2:3
      'smart': [0.85, 0.76]  // 稍微调整以适应 2:3
    };

    // 根据名称获取位置
    const getPositionByName = (name) => {
      let key;
      if (name === 'Grid') key = 'grid';
      else if (name === 'Solar') key = 'solar';
      else if (name === 'Battery') key = 'battery';
      else if (name === 'Home Load') key = 'home';
      else if (name === 'Charger') key = 'charger';
      else if (name === 'Load') key = 'smart';
      else key = name.toLowerCase();
      const ratio = positionRatios[key];
      return ratio ? calculatePosition(ratio[0], ratio[1]) : calculatePosition(0.5, 0.5);
    };
    if (nodes.value) {
      // --- 更新节点数据 (使用模拟功率) ---
      nodes.value = [
        {
          name: 'Grid',
          power: gridPower,
          value: `${gridPower.toFixed(1)} W`,
          ...getPositionByName('Grid'),
          color: '#673AB7', // 紫色
          icon: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZD0iTTEyIDJ2NC4wM0E4IDggMCAwIDAgNi4wNCAxMkgydjJoNC4wM0E4IDggMCAwIDAgMTIgMTkuOTZWMjRoMnYtNC4wM0E4IDggMCAwIDAgMTkuOTYgMTRIMjR2LTJoLTQuMDNBOCA4IDAgMCAwIDE0IDYuMDRWMmgtMnptLTIgMTBhMiAyIDAgMSAxIDIgMiAyIDIgMCAwIDEtMi0yeiIgZmlsbD0iIzY3M0FCNyIvPjwvc3ZnPg==',
          // workMode 由你之后动态传入
          workMode: gridPower > 0 ? -1 : 1, // 模拟：>0买电(输入), <0卖电(输出)
        },
        {
          name: 'Solar',
          power: solarPower,
          // 只显示Solar功率
          value: `${solarPower.toFixed(1)} W`,
          ...getPositionByName('Solar'),
          color: '#FF9800', // 橙色
          icon: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZD0iTTMuNSAxOGgxN3YyaC0xN3YtMnptMTctMTJoMnYxMGgtMlY2em0tNCAzaDJ2N2gtMlY5em0tNCAtM2gydjEwaC0yVjZ6bS00IDZoMnY0aC0ydi00em0tNCAtM2gydjdIM1Y5eiIgZmlsbD0iI0ZGOTgwMCIvPjwvc3ZnPg==',
          workMode: solarPower > 0 ? 1 : 0, // Solar总是发电 (输出)
        },
        {
          name: 'Battery',
          power: batPower,
          value: `${batPower > 0 ? `Discharge: ${batPower.toFixed(1)} W` : `Charge: ${Math.abs(batPower).toFixed(1)} W`}`,
          ...getPositionByName('Battery'),
          color: '#00BCD4', // 青色
          icon: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZD0iTTE2IDEwSDh2NEgxNnYtNHptLjY3LThIMTVWMGgtNnYySDcuMzNBMS4zMyAxLjMzIDAgMCAwIDYgMy4zM3YxNy4zNGMwIC43My42IDEuMzMgMS4zMyAxLjMzaDkuMzRjLjczIDAgMS4zMy0uNiAxLjMzLTEuMzNWMy4zM0ExLjMzIDEuMzMgMCAwIDAgMTYuNjcgMnoiIGZpbGw9IiMwMEJDRDQiLz48L3N2Zz4=',
          // workMode 由你之后动态传入
          workMode: batPower > 0 ? 1 : (batPower < 0 ? -1 : 0), // 模拟：放电(输出)/充电(输入)/静止
        },
        {
          name: 'Home Load',
          power: totalHomeLoad,
          value: `Total: ${totalHomeLoad.toFixed(1)} W`, // 只显示总Load功率
          ...getPositionByName('Home Load'),
          // color: '#F44336', // 改为红色，表示消耗
          color: '#00BCD4', // 保持原来的青色
          icon: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZD0iTTEyIDNMNCAxMHYxMmgxNlYxMGwtOC03em02IDE0aC0zdi01aC02djVINnYtN2w2LTUgNiA1djd6IiBmaWxsPSIjMDBCQ0Q0Ii8+PC9zdmc+', // 家庭图标
          workMode: totalHomeLoad > 0 ? -1 : 0, // Load总是输入
        },
        {
          name: 'Charger',
          power: chargerPower,
          // 只显示Charger功率
          value: `${chargerPower.toFixed(1)} W`,
          ...getPositionByName('Charger'),
          color: '#4CAF50', // 绿色
          icon: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZD0iTTEyIDE4SDZWMmgxNHYxNmgtOHptMi01aDJ2LTJoMlY5aC0yVjdoLTJ2MmgtdmwtNC45IDloNi45eiIgZmlsbD0iIzRDQUY1MCIvPjwvc3ZnPg==',
          workMode: chargerPower > 0 ? -1 : 0, // Load总是输入
        },
        {
          name: 'Load',
          power: smartPower,
          // 只显示Load功率
          value: `${smartPower.toFixed(1)} W`,
          ...getPositionByName('Load'),
          color: '#FF5722', // 红色
          icon: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZD0iTTUgM3YxNmgxNlYzSDV6bTE0IDE0SDdWNWgxMnYxMnptLTctMWgyek0xNSA4aDJ2OGgtMlY4ek0xMSA4aDJ2M2gtMnYtM3ptMCA1aDJ2M2gtMnYtM3pNNyA4aDJ2MkgzVjhoNHY1eiIgZmlsbD0iI0ZGNTcyMiIvPjwvc3ZnPg==',
          workMode: smartPower > 0 ? -1 : 0, // Load总是输入
        }
      ];
    }
    // --- 创建包含所有路径的静态 links 数组 (用于测试) ---
    // 颜色根据能量源确定
    if (links.value) {
      links.value = [
        // 从Solar出发 (橙色)
        {source: 'Solar', target: 'Home Load', value: 200, color: '#FF9800'}, // 曲线
        {source: 'Solar', target: 'Battery', value: 200, color: '#FF9800'},     // 直线
        {source: 'Solar', target: 'Grid', value: 200, color: '#FF9800'},     // 曲线 (模拟卖给Grid)

        // 从Battery出发 (青色) - 假设Battery正在放电 (batPower > 0)
        {source: 'Battery', target: 'Home Load', value: 200, color: '#00BCD4'}, // 曲线
        {source: 'Battery', target: 'Grid', value: 200, color: '#00BCD4'},     // 曲线 (模拟卖给Grid)

        // 从Grid出发 (紫色) - 假设Grid需要供电给Battery (模拟 gridPower > 0 或需要充电)
        // 如果 gridPower < 0 (如模拟数据)，这条线理论上不该出现，但为了测试显示，我们强制画一个
        // 更好的模拟是让 gridPower > 0, batPower < 0
        {source: 'Grid', target: 'Home Load', value: 200, color: '#673AB7'}, // 曲线 (假设Grid给Load供电)
        {source: 'Grid', target: 'Battery', value: 200, color: '#673AB7'},     // 曲线 (假设Grid给Battery充电)

        // 从Home Load出发 (到子Load，颜色匹配子Load)
        {source: 'Home Load', target: 'Charger', value: 200, color: '#4CAF50'}, // 直线 (绿色)
        {source: 'Home Load', target: 'Load', value: 200, color: '#FF5722'}  // 直线 (红色)
      ].filter(link => link.value !== 0); // 过滤掉 value 为 0 的连接 (虽然这里都是非零)
    }


    console.log("Using Simulated Links:", links.value); // 打印最终使用的 links

    // setData 前无需调用 resize，setData 会触发绘制，绘制前会确保尺寸
    energyChart.setData(nodes.value, links.value);
  }

  // 更新统计图
  if (statChart) {
    // 确保图表实例存在
    if (!statChart._disposed) {
      try {
        // 使用保存的batSn值调用getStatusNow
        console.log("[ha-vue-card] 获取batSn:", currentBatSn.value);
        const powerData = await getStatusNow(selectedPlantId.value, (currentBatSn.value ? currentBatSn.value : ''));
        console.log("[ha-vue-card] 获取功率数据:", powerData);

        if (powerData) {
          // 提取所有时间点
          const times = Object.keys(powerData.solarMap || {}).sort();

          // 准备四种数据系列，确保null值被转换为0
          const solarPowerData = times.map(time => (powerData.solarMap[time] !== null && powerData.solarMap[time] !== undefined) ? powerData.solarMap[time] : 0);
          const gridPowerData = times.map(time => (powerData.gridMap[time] !== null && powerData.gridMap[time] !== undefined) ? powerData.gridMap[time] : 0);
          const batPowerData = times.map(time => (powerData.batMap[time] !== null && powerData.batMap[time] !== undefined) ? powerData.batMap[time] : 0);
          const loadPowerData = times.map(time => (powerData.loadMap[time] !== null && powerData.loadMap[time] !== undefined) ? powerData.loadMap[time] : 0);

          // 使用nextTick确保DOM已更新
          nextTick(() => {
            statChart.setOption({
              title: {
                text: 'Power Curve',
                left: 'center',
                top: 0,
                textStyle: {
                  fontSize: 16,
                  color: 'var(--primary-text-color)' // 使用主题变量
                }
              },
              tooltip: {
                trigger: 'axis',
                formatter: function (params) {
                  let result = params[0].axisValue + '<br/>';
                  params.forEach(param => {
                    result += param.marker + param.seriesName + ': ' + param.value + ' W<br/>';
                  });
                  return result;
                }
              },
              legend: {
                data: ['Solar Power', 'Grid Power', 'Battery Power', 'Load Power'],
                bottom: 0,
                itemWidth: 15,
                itemHeight: 10,
                textStyle: {
                  fontSize: 12,
                  color: 'var(--primary-text-color)' // 使用主题变量
                }
              },
              grid: {left: '3%', right: '4%', bottom: '15%', top: '15%', containLabel: true},
              xAxis: {
                type: 'category',
                data: times,
                axisLabel: {
                  // 只显示部分时间点标签
                  interval: Math.max(Math.floor(times.length / 12), 1),
                  rotate: 45,
                  fontSize: 10,
                  color: 'var(--primary-text-color)' // 使用主题变量
                },
                // 确保x轴可以显示指示器
                axisPointer: {
                  show: true,
                  label: {
                    show: true
                  }
                },
              },
              yAxis: {
                type: 'value',
                name: 'Power (W)',
              },
              series: [
                {
                  name: 'Solar Power',
                  type: 'line',
                  data: solarPowerData,
                  smooth: true,
                  symbol: 'circle',
                  // 显示所有数据点
                  showSymbol: true,
                  symbolSize: 5,
                  // 移除采样以显示所有点
                  sampling: 'none',
                  itemStyle: {color: '#FF9800'},
                  areaStyle: {opacity: 0.2},
                  lineStyle: {width: 2, color: '#FF9800'}
                },
                {
                  name: 'Grid Power',
                  type: 'line',
                  data: gridPowerData,
                  smooth: true,
                  symbol: 'circle',
                  showSymbol: true,
                  symbolSize: 5,
                  sampling: 'none',
                  itemStyle: {color: '#673AB7'},
                  areaStyle: {opacity: 0.2},
                  lineStyle: {width: 2, color: '#673AB7'}
                },
                {
                  name: 'Battery Power',
                  type: 'line',
                  data: batPowerData,
                  smooth: true,
                  symbol: 'circle',
                  showSymbol: true,
                  symbolSize: 5,
                  sampling: 'none',
                  itemStyle: {color: '#00BCD4'},
                  areaStyle: {opacity: 0.2},
                  lineStyle: {width: 2, color: '#00BCD4'}
                },
                {
                  name: 'Load Power',
                  type: 'line',
                  data: loadPowerData,
                  smooth: true,
                  symbol: 'circle',
                  showSymbol: true,
                  symbolSize: 5,
                  sampling: 'none',
                  itemStyle: {color: '#F44336'},
                  areaStyle: {opacity: 0.2},
                  lineStyle: {width: 2, color: '#F44336'}
                }
              ]
            });
            console.log("[ha-vue-card] 统计图更新成功");
          });
        }
      } catch (error) {
        console.error("[ha-vue-card] 获取功率数据或更新统计图失败:", error);

        // 如果API调用失败，使用默认模拟数据
        const timeCategories = ['00:00', '03:00', '06:00', '09:00', '12:00', '15:00', '18:00', '21:00'];
        const mockData = {
          battery: [1200, 1800, 2200, 2500, 2000, 1500, 1000, 800],
          solar: [0, 500, 2000, 3500, 3500, 2500, 2000, 500],
          grid: [1500, 1200, 800, 500, 700, 800, 1200, 1800],
          load: [2000, 2500, 2800, 3000, 3200, 3000, 2500, 2000]
        };

        // 使用模拟数据更新图表
        nextTick(() => {
          statChart.setOption({
            title: {
              text: 'Power Curve (Simulated Data)',
              left: 'center',
              top: 0,
              textStyle: {
                fontSize: 16,
                color: 'var(--primary-text-color)' // 使用主题变量
              }
            },
            tooltip: {trigger: 'axis', formatter: p => p.map(i => `${i.seriesName}: ${i.value} W`).join('<br/>')},
            legend: {
              data: ['Battery Power', 'Solar Power', 'Grid Power', 'Load Power'],
              bottom: 0,
              itemWidth: 15,
              itemHeight: 10,
              textStyle: {
                fontSize: 12,
                color: 'var(--primary-text-color)' // 使用主题变量
              }
            },
            grid: {left: '3%', right: '4%', bottom: '15%', top: '15%', containLabel: true},
            xAxis: {
              type: 'category',
              data: timeCategories,
              axisLabel: {
                interval: 0,
                rotate: 30,
                fontSize: 10,
                color: 'var(--primary-text-color)' // 使用主题变量
              },
              axisLine: {
                lineStyle: {
                  color: 'var(--primary-text-color)' // 使用主题变量
                }
              }
            },
            yAxis: {
              type: 'value',
              name: 'Power (W)',
              nameTextStyle: {
                fontSize: 12,
                color: 'var(--primary-text-color)' // 使用主题变量
              },
              axisLabel: {
                fontSize: 10,
                color: 'var(--primary-text-color)' // 使用主题变量
              },
              axisLine: {
                lineStyle: {
                  color: 'var(--primary-text-color)' // 使用主题变量
                }
              },
              splitLine: {
                lineStyle: {
                  color: 'rgba(128, 128, 128, 0.2)' // 使用半透明灰色，适应两种模式
                }
              }
            },
            series: [
              {
                name: 'Battery Power',
                type: 'line',
                data: mockData.battery,
                smooth: true,
                symbol: 'circle',
                symbolSize: 8,
                itemStyle: {color: '#00BCD4'},
                lineStyle: {width: 3, color: '#00BCD4'}
              },
              {
                name: 'Solar Power',
                type: 'line',
                data: mockData.solar,
                smooth: true,
                symbol: 'circle',
                symbolSize: 8,
                itemStyle: {color: '#FF9800'},
                lineStyle: {width: 3, color: '#FF9800'}
              },
              {
                name: 'Grid Power',
                type: 'line',
                data: mockData.grid,
                smooth: true,
                symbol: 'circle',
                symbolSize: 8,
                itemStyle: {color: '#673AB7'},
                lineStyle: {width: 3, color: '#673AB7'}
              },
              {
                name: 'Load Power',
                type: 'line',
                data: mockData.load,
                smooth: true,
                symbol: 'circle',
                symbolSize: 8,
                itemStyle: {color: '#F44336'},
                lineStyle: {width: 3, color: '#F44336'}
              }
            ]
          });
        });
      }
    } else {
      console.warn("[ha-vue-card] 统计图实例已销毁，尝试重新初始化");
      // 尝试重新初始化
      if (statsChart.value) {
        statChart = echarts.init(statsChart.value);
      }
    }
  } else {
    console.warn("[ha-vue-card] 统计图实例不存在");
    // 检查容器是否存在，尝试初始化
    if (statsChart.value) {
      statChart = echarts.init(statsChart.value);
    }
  }
};

// 更新实体分组数据
const updateEntityGroups = async () => {
  try {
    // 获取逆变器详细信息
    if (deviceInfo.value.emSn && deviceInfo.value.emType) {
      try {
        const meterInfo = await getDeviceBySn(deviceInfo.value.emType, deviceInfo.value.emSn);
        deviceDetailInfo.value.meter = meterInfo;
        console.log("[ha-vue-card] 获取电表详细信息:", meterInfo);
      } catch (error) {
        console.error("[ha-vue-card] 获取电表详细信息失败:", error);
      }
    }

    // 获取储能详细信息
    if (deviceInfo.value.batSn && deviceInfo.value.batType) {
      try {
        const batteryInfo = await getDeviceBySn(deviceInfo.value.batType, deviceInfo.value.batSn);
        deviceDetailInfo.value.battery = batteryInfo;
        console.log("[ha-vue-card] 获取Battery详细信息:", batteryInfo);
      } catch (error) {
        console.error("[ha-vue-card] 获取Battery详细信息失败:", error);
      }
    }

    // 获取Load设备详细信息
    if (deviceInfo.value.loadList && deviceInfo.value.loadList.length > 0) {
      console.log("[ha-vue-card] 获取Load设备详细信息", deviceInfo.value.loadList);
      deviceDetailInfo.value.loads = [];
      for (const load of deviceInfo.value.loadList) {
        try {
          if (load.deviceSn && load.iconType) {
            const loadInfo = await getDeviceBySn(load.iconType, load.deviceSn);
            deviceDetailInfo.value.loads.push({
              deviceSn: load.deviceSn,
              iconType: load.iconType,
              details: loadInfo
            });
            console.log("[ha-vue-card] 获取Load设备详细信息:", loadInfo);
          }
        } catch (error) {
          console.error("[ha-vue-card] 获取Load设备详细信息失败:", error);
        }
      }
    }

    // 获取Charger设备详细信息
    if (deviceInfo.value.chargerList && deviceInfo.value.chargerList.length > 0) {
      console.log("[ha-vue-card] 获取充电桩设备详细信息", deviceInfo.value.chargerList);
      deviceDetailInfo.value.chargers = [];
      for (const charger of deviceInfo.value.chargerList) {
        try {
          if (charger.deviceSn && charger.iconType) {
            const chargerInfo = await getDeviceBySn(charger.iconType, charger.deviceSn);
            deviceDetailInfo.value.chargers.push({
              deviceSn: charger.deviceSn,
              iconType: charger.iconType,
              details: chargerInfo
            });
            console.log("[ha-vue-card] 获取Charger设备详细信息:", chargerInfo);
          }
        } catch (error) {
          console.error("[ha-vue-card] 获取Charger设备详细信息失败:", error);
        }
      }
    }

    // 更新实体组数据
    updateEntityGroupsFromDeviceInfo();
  } catch (error) {
    console.error("[ha-vue-card] 更新实体数据失败:", error);
  }
};

// 从设备信息更新实体组
const updateEntityGroupsFromDeviceInfo = () => {
  // 创建新的实体组
  const newGroups = [
    {
      name: 'Battery',
      expanded: false,
      entities: [], // 基本信息
      subGroups: generateBatSubGroups()
    },
    {
      name: 'Meter',
      expanded: false,
      entities: [], // 基本信息
      subGroups: generateMeterSubGroups()
    }
  ];

  // 添加设备基本信息到主组
  newGroups[0].entities = [
    {id: 'battery.sn', description: 'SN', value: deviceInfo.value.batSn || 'unknown', unit: ''},
    // { id: 'battery.type', description: 'TYPE', value: deviceInfo.value.batType || 'unknown', unit: '' }
  ];
  newGroups[1].entities = [
    {id: 'meter.sn', description: 'SN', value: deviceInfo.value.emSn || 'unknown', unit: ''},
    // { id: 'meter.type', description: 'TYPE', value: deviceInfo.value.emType || 'unknown', unit: '' }
  ];

  // 添加Load设备组
  if (deviceInfo.value.loadList && deviceInfo.value.loadList.length > 0) {
    newGroups.push({
      name: 'Load Devices',
      expanded: false,
      entities: deviceInfo.value.loadList.map(load => ({
        id: `load.${load.deviceSn}`,
        description: `Load ${load.deviceSn}`,
        value: load.deviceSn,
        unit: '',
        switchStatus: load.switchStatus
      })),
      subGroups: generateLoadSubGroups()
    });
  }

  // 添加Charger设备组
  if (deviceInfo.value.chargerList && deviceInfo.value.chargerList.length > 0) {
    newGroups.push({
      name: 'Charger Devices',
      expanded: false,
      entities: deviceInfo.value.chargerList.map(charger => ({
        id: `charger.${charger.deviceSn}`,
        description: `Charger ${charger.deviceSn}`,
        value: charger.deviceSn,
        unit: '',
        switchStatus: charger.switchStatus
      })),
      subGroups: generateChargerSubGroups()
    });
  }

  // 更新实体组
  entityGroups.value = newGroups;
};

// 生成Bat子组
const generateBatSubGroups = () => {
  const subGroups = [];

  if (deviceDetailInfo.value.battery && deviceDetailInfo.value.battery.deviceInfoMap) {
    const deviceInfoMap = deviceDetailInfo.value.battery.deviceInfoMap;

    // 遍历每个分类（如"基础信息"等）
    for (const [category, items] of Object.entries(deviceInfoMap)) {
      // 创建子组
      const subGroup = {
        name: category,
        expanded: false,
        entities: []
      };

      // 遍历该分类下的所有键值对
      for (const [key, value] of Object.entries(items)) {
        if (value !== null && value !== undefined) {
          // 提取单位（如果有）
          let displayValue = value;
          let unit = '';

          // 尝试从值中提取单位，比如"200.0W"中的"W"
          const match = String(value).match(/^([\d.]+)(\D+)$/);
          if (match) {
            displayValue = match[1];
            unit = match[2];
          }

          subGroup.entities.push({
            id: `battery.${category}.${key}`,
            description: key,
            value: displayValue,
            unit: unit
          });
        }
      }

      // 只添加有实体的子组
      if (subGroup.entities.length > 0) {
        subGroups.push(subGroup);
      }
    }
  }

  return subGroups;
};

// 生成Meter子组
const generateMeterSubGroups = () => {
  const subGroups = [];

  if (deviceDetailInfo.value.meter && deviceDetailInfo.value.meter.deviceInfoMap) {
    const deviceInfoMap = deviceDetailInfo.value.meter.deviceInfoMap;

    // 遍历每个分类（如"基础信息"等）
    for (const [category, items] of Object.entries(deviceInfoMap)) {
      // 创建子组
      const subGroup = {
        name: category,
        expanded: false,
        entities: []
      };

      // 遍历该分类下的所有键值对
      for (const [key, value] of Object.entries(items)) {
        if (value !== null && value !== undefined) {
          // 提取单位（如果有）
          let displayValue = value;
          let unit = '';

          // 尝试从值中提取单位，比如"200.0W"中的"W"
          const match = String(value).match(/^([\d.]+)(\D+)$/);
          if (match) {
            displayValue = match[1];
            unit = match[2];
          }

          subGroup.entities.push({
            id: `meter.${category}.${key}`,
            description: key,
            value: displayValue,
            unit: unit
          });
        }
      }

      // 只添加有实体的子组
      if (subGroup.entities.length > 0) {
        subGroups.push(subGroup);
      }
    }
  }

  return subGroups;
};

// 生成Load子组
const generateLoadSubGroups = () => {
  const subGroups = [];

  if (deviceDetailInfo.value.loads && deviceDetailInfo.value.loads.length > 0) {
    for (const load of deviceDetailInfo.value.loads) {
      if (load.details && load.details.deviceInfoMap) {
        const deviceInfoMap = load.details.deviceInfoMap;

        // 为每个Load设备创建一个子组
        const subGroup = {
          name: `Load ${load.deviceSn}`,
          expanded: false,
          entities: []
        };

        // 遍历每个分类（如"基础信息"等）
        for (const [category, items] of Object.entries(deviceInfoMap)) {
          // 遍历该分类下的所有键值对
          for (const [key, value] of Object.entries(items)) {
            if (value !== null && value !== undefined) {
              // 提取单位（如果有）
              let displayValue = value;
              let unit = '';

              // 尝试从值中提取单位，比如"200.0W"中的"W"
              const match = String(value).match(/^([\d.]+)(\D+)$/);
              if (match) {
                displayValue = match[1];
                unit = match[2];
              }

              subGroup.entities.push({
                id: `load.${load.deviceSn}.${category}.${key}`,
                description: key,
                value: displayValue,
                unit: unit
              });
            }
          }
        }

        // 只添加有实体的子组
        if (subGroup.entities.length > 0) {
          subGroups.push(subGroup);
        }
      }
    }
  }

  return subGroups;
};

// 生成Charger子组
const generateChargerSubGroups = () => {
  const subGroups = [];

  if (deviceDetailInfo.value.chargers && deviceDetailInfo.value.chargers.length > 0) {
    for (const charger of deviceDetailInfo.value.chargers) {
      if (charger.details && charger.details.deviceInfoMap) {
        const deviceInfoMap = charger.details.deviceInfoMap;

        // 为每个Charger设备创建一个子组
        const subGroup = {
          name: `Charger ${charger.deviceSn}`,
          expanded: false,
          entities: []
        };

        // 遍历每个分类（如"基础信息"等）
        for (const [category, items] of Object.entries(deviceInfoMap)) {
          // 遍历该分类下的所有键值对
          for (const [key, value] of Object.entries(items)) {
            if (value !== null && value !== undefined) {
              // 提取单位（如果有）
              let displayValue = value;
              let unit = '';

              // 尝试从值中提取单位，比如"200.0W"中的"W"
              const match = String(value).match(/^([\d.]+)(\D+)$/);
              if (match) {
                displayValue = match[1];
                unit = match[2];
              }

              subGroup.entities.push({
                id: `charger.${charger.deviceSn}.${category}.${key}`,
                description: key,
                value: displayValue,
                unit: unit
              });
            }
          }
        }

        // 只添加有实体的子组
        if (subGroup.entities.length > 0) {
          subGroups.push(subGroup);
        }
      }
    }
  }

  return subGroups;
};

// Home Assistant Web Component 生命周期方法
const setConfig = (config) => {
  console.log('[ha-vue-card] setConfig被调用', config);
  if (config) {
    console.log('[ha-vue-card] 当前配置:', config);
    name.value = config.name || 'Vue Card';
    
    // 保存配置到全局变量
    if (typeof window !== 'undefined') {
      window.haCard = {
        config: config
      };
    }
  }
};

// 添加Home Assistant所需的生命周期方法
const getCardSize = () => {
  console.log('[ha-vue-card] getCardSize被调用');
  return 1;
};

defineExpose({
  setConfig,
  getCardSize,
  attributeChangedCallback,
  getObservedAttributes,
  set hass(value) {
    console.log('[ha-vue-card] hass属性更新', value);
    if (value) {
      props.hass = value;
    }
  }
});

const getEntityIcon = (entityId) => {
  const type = entityId.split('.')[0];
  switch (type) {
    case 'sensor':
      return 'mdi-thermometer';
    case 'switch':
      return 'mdi-power';
    case 'light':
      return 'mdi-lightbulb';
    case 'climate':
      return 'mdi-thermostat';
    default:
      return 'mdi-help-circle';
  }
};

// 设备相关数据
const deviceInfo = ref({

  batSn: '',
  batType: '',
  // 电表
  emSn: '',
  emType: '',
  //....
});

// 设备详细信息
const deviceDetailInfo = ref({
  inv: null, // 逆变器详细信息
  bat: null,   // Battery详细信息
  load: null, // Load详细信息
  charger: null, // Charger详细信息
  em: null, // 电表详细信息
  solar: null, // 太阳能详细信息
  grid: null, // Grid详细信息
});

// AI绿电计划状态
const aiPlanState = ref('Loading...');

// 获取AI绿电计划数据
const fetchAiPlanData = async () => {
  try {
    const aiData = await getAiSystemByPlantId(selectedPlantId.value);
    console.log('[ha-vue-card] 获取AI绿电计划数据:', aiData);

    if (aiData) {
      // 根据Python逻辑处理AI状态
      aiPlanState.value = aiData.modeStr
    } else {
      aiPlanState.value = "No Data";
    }
  } catch (error) {
    console.error('[ha-vue-card] 获取AI绿电计划数据失败:', error);
    aiPlanState.value = "Error";
  }
};



</script>

<style scoped>
.panel {
  height: 100%;
  width: 100%;
  padding: 24px;
  box-sizing: border-box;
  background-color: var(--primary-background-color);
  color: var(--primary-text-color);
  --primary-color: #ff9800;
  --secondary-color: #ffb74d;
  --accent-color: #ffd180;
}

.plant-selector-card {
  background: var(--card-background-color);
  border-radius: 8px;
  padding: 16px;
  display: flex;
  align-items: center;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  height: auto;
  min-height: 60px;
  z-index: 10;
  position: relative;
}

.plant-selector-card label {
  margin-right: 12px;
  font-weight: 500;
}

.plant-selector-card select {
  flex: 1;
  padding: 8px 12px;
  border-radius: 4px;
  border: 1px solid var(--divider-color);
  background-color: var(--card-background-color);
  color: var(--primary-text-color);
  font-size: 14px;
}

.content {
  margin-top: 24px;
}

h1 {
  margin: 0;
  font-size: 24px;
  font-weight: 400;
  border-bottom: 1px solid var(--divider-color);
  padding-bottom: 16px;
}

.chart-container {
  margin: 20px 0;
  width: 100%;
  position: relative;
}

/* 能流图容器 */
.energy-flow-container {
  height: 0; /* 使用 padding-bottom 技巧必须设置 height 为 0 或 auto */
  min-height: 250px; /* 保留最小高度 */
  /* --- 设置外部容器的视觉宽高比为 9:10 --- */
  padding-bottom: 90% !important;
  position: relative;
  width: 100%;
  box-sizing: border-box;
  overflow: hidden; /* 隐藏可能超出容器的内容，虽然理论上不应超出 */
}

/* 内部 chart (Canvas 的父 div) 占据容器 */
.energy-flow-container .chart {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%; /* 撑满由 padding-bottom 创建的空间 */
  box-sizing: border-box;
}

/* 功率曲线图容器 */
.chart-container:nth-child(2) {
  padding-bottom: 80% !important;
  background: var(--card-background-color);
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  margin-bottom: 16px;
}

.chart {
  width: 100%;
  background: var(--card-background-color);
  border-radius: 8px;
  padding: 16px;
  box-sizing: border-box;
}

.entities-container {
  margin-top: 20px;
  width: 100%;
}

.section-title {
  text-align: center;
  font-size: 18px;
  margin-bottom: 16px;
  color: var(--primary-text-color);
}

.sub-section-title {
  text-align: center;
  font-size: 16px;
  margin: 12px 0;
  color: var(--secondary-text-color);
}

.entity-group {
  margin-bottom: 16px;
  border: 1px solid var(--divider-color);
  border-radius: 8px;
  overflow: hidden;
}

.group-header {
  padding: 12px 16px;
  background: var(--secondary-background-color);
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 2px solid var(--primary-color);
  transition: background-color 0.3s ease;
}

.group-header:hover {
  background-color: rgba(255, 152, 0, 0.1);
}

.arrow {
  transition: transform 0.3s ease;
}

.arrow.expanded {
  transform: rotate(180deg);
}

.group-content {
  padding: 8px;
}

.entity-subgroup {
  margin: 8px;
  border: 1px solid var(--divider-color);
  border-radius: 4px;
  overflow: hidden;
}

.subgroup-header {
  padding: 8px 12px;
  background: var(--secondary-background-color);
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.9em;
}

.subgroup-content {
  padding: 4px;
  background: var(--card-background-color);
}

.entity-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  background: var(--card-background-color);
  margin: 8px;
  border-radius: 4px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  border-left: 3px solid var(--primary-color);
  transition: all 0.3s ease;
}

.entity-card:hover {
  transform: translateX(2px);
  box-shadow: 0 4px 8px rgba(255, 152, 0, 0.2);
}

.entity-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.entity-description {
  font-size: 14px;
  color: var(--primary-text-color);
}

.entity-value {
  font-size: 14px;
  font-weight: 500;
  color: var(--primary-color);
  padding: 4px 8px;
  background-color: rgba(255, 152, 0, 0.1);
  border-radius: 4px;
}

.mdi {
  font-size: 20px;
  color: var(--primary-color);
  transition: transform 0.3s ease;
}

.mdi:hover {
  transform: scale(1.1);
}

@media (max-width: 600px) {
  .panel {
    padding: 16px;
  }

  .plant-selector-card {
    padding: 12px;
    min-height: 70px;
    /* 移动端增加更多高度 */
  }

  .energy-flow-container {
    min-height: 200px;
    /* --- 移动端也调整为 9:10 --- */
    padding-bottom: 90% !important;
  }

  .chart-container:nth-child(2) {
    padding-bottom: 120% !important;
    width: 100%;
    box-sizing: border-box;
    overflow: hidden; /* 防止内容溢出 */
  }

  .chart {
    padding: 8px;
    width: 100%;
    box-sizing: border-box;
  }

  .entity-card {
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
  }

  .entity-description {
    flex: 7;
  }

  .entity-value {
    flex: 3;
    text-align: right;
  }
}

/* 能源总计卡片样式 */
.energy-summary-container {
  margin-top: 30px;
  width: 100%;
}

.energy-summary-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-top: 16px;
}

.energy-summary-card {
  display: flex;
  align-items: center;
  padding: 16px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.energy-summary-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
}

.energy-summary-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 50px;
  height: 50px;
  border-radius: 50%;
  margin-right: 16px;
}

.energy-summary-icon .mdi {
  font-size: 24px;
  color: white;
}

.energy-summary-content {
  flex: 1;
}

.energy-summary-title {
  font-size: 14px;
  color: var(--secondary-text-color);
  margin-bottom: 4px;
}

.energy-summary-value {
  font-size: 24px;
  font-weight: 600;
  color: var(--primary-text-color);
}

/* 卡片颜色 */
.energy-summary-card.solar .energy-summary-icon {
  background-color: #FF9800;
}

.energy-summary-card.grid .energy-summary-icon {
  background-color: #673AB7;
}

.energy-summary-card.load .energy-summary-icon {
  background-color: #F44336;
}

.energy-summary-card.battery .energy-summary-icon {
  background-color: #00BCD4;
}

.energy-summary-card.grid-buy .energy-summary-icon {
  background-color: #9C27B0;
}

.energy-summary-card.battery-discharge .energy-summary-icon {
  background-color: #009688;
}

@media (max-width: 600px) {
  .energy-summary-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 8px; /* 在移动端减小间距 */
  }
  
  .energy-summary-card {
    padding: 10px; /* 在移动端减小内边距 */
  }
  
  .energy-summary-icon {
    width: 40px; /* 在移动端减小图标尺寸 */
    height: 40px;
    margin-right: 10px;
  }
  
  .energy-summary-icon .mdi {
    font-size: 20px; /* 在移动端减小图标字体大小 */
  }
  
  .energy-summary-title {
    font-size: 12px; /* 在移动端减小标题字体大小 */
  }
  
  .energy-summary-value {
    font-size: 18px; /* 在移动端减小数值字体大小 */
  }
}

/* AI绿电计划卡片样式 */
.ai-plan-card {
  background: var(--card-background-color);
  border-radius: 8px;
  padding: 16px;
  display: flex;
  align-items: center;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  height: auto;
  min-height: 60px;
  z-index: 10;
  position: relative;
}

.ai-plan-card label {
  margin-right: 12px;
  font-weight: 500;
}

.ai-plan-value {
  flex: 1;
  padding: 8px 12px;
  border-radius: 4px;
  background-color: rgba(255, 152, 0, 0.1);
  color: var(--primary-color);
  font-weight: 500;
  text-align: center;
}

/* 设备开关样式 */
.device-switch {
  --mdc-switch-selected-track-color: var(--primary-color);
  --mdc-switch-selected-handle-color: var(--primary-color);
  --mdc-switch-unselected-track-color: var(--disabled-text-color);
  --mdc-switch-unselected-handle-color: var(--disabled-text-color);
}

.sub-group-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 16px;
  background-color: var(--card-background-color);
  border-radius: 4px;
  margin-bottom: 8px;
}

.sub-group-name {
  font-weight: 500;
  color: var(--primary-text-color);
}

.device-switch-container {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 8px;
}

.device-switch-button {
  --mdc-switch-selected-track-color: var(--primary-color);
  --mdc-switch-selected-handle-color: var(--primary-color);
  --mdc-switch-unselected-track-color: var(--disabled-text-color);
  --mdc-switch-unselected-handle-color: var(--disabled-text-color);
}

.device-switch-button.on {
  background-color: var(--primary-color);
  color: white;
}

.device-switch-button.off {
  background-color: var(--disabled-text-color);
  color: var(--primary-text-color);
}

.entity-value-container {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.device-switch-container {
  display: flex;
  justify-content: flex-end;
  margin-top: 8px;
}

.device-switch-button {
  padding: 4px 12px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  border: none;
  transition: all 0.3s ease;
  min-width: 60px;
  text-align: center;
}

.device-switch-button.on {
  background-color: #4CAF50;
  color: white;
  box-shadow: 0 2px 4px rgba(76, 175, 80, 0.3);
}

.device-switch-button.off {
  background-color: #9E9E9E;
  color: white;
  box-shadow: 0 2px 4px rgba(158, 158, 158, 0.3);
}

.device-switch-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
}

@media (max-width: 600px) {
  .device-switch-button {
    padding: 3px 10px;
    font-size: 11px;
    min-width: 50px;
  }
}

.configuration-help {
  background: var(--card-background-color);
  border-radius: 8px;
  padding: 20px;
  margin: 16px 0;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  color: var(--primary-text-color);
}

.configuration-help h2 {
  color: var(--error-color, #eb5757);
  margin-top: 0;
}

.configuration-help ol {
  padding-left: 20px;
}

.configuration-help pre {
  background: rgba(0, 0, 0, 0.05);
  padding: 12px;
  border-radius: 4px;
  overflow-x: auto;
  font-family: monospace;
  margin: 8px 0;
}

/* 登录表单样式 */
.credentials-form {
  max-width: 400px;
  margin: 40px auto;
  padding: 24px;
  background: var(--card-background-color);
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  color: var(--primary-text-color);
}

.credentials-form h2 {
  margin-top: 0;
  text-align: center;
  color: var(--primary-color);
  margin-bottom: 16px;
}

.credentials-form p {
  text-align: center;
  margin-bottom: 24px;
  color: var(--secondary-text-color);
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
}

.form-group input[type="text"],
.form-group input[type="password"] {
  width: 100%;
  padding: 10px;
  border-radius: 4px;
  border: 1px solid var(--divider-color);
  background-color: var(--card-background-color);
  color: var(--primary-text-color);
  font-size: 14px;
  box-sizing: border-box;
}

.checkbox-container {
  display: flex;
  align-items: center;
  cursor: pointer;
  user-select: none;
  font-size: 14px;
}

.checkbox-container input {
  margin-right: 8px;
}

.login-button {
  width: 100%;
  padding: 10px;
  margin-top: 16px;
  background-color: var(--primary-color);
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.3s;
}

.login-button:hover {
  background-color: var(--light-primary-color);
}

.login-button:disabled {
  background-color: var(--disabled-color, #cccccc);
  cursor: not-allowed;
}

.error-message {
  margin-top: 16px;
  padding: 10px;
  background-color: rgba(235, 87, 87, 0.1);
  color: var(--error-color, #eb5757);
  border-radius: 4px;
  text-align: center;
  font-size: 14px;
}
</style>
