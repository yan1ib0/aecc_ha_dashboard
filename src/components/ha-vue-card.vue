<template>
  <div class="panel">
    <!-- 新增：电站选择卡片区域 -->
    <h2>{{ name }}</h2>
    <div class="plant-selector-card" style="margin-bottom: 16px;">
      <label for="plant-select">选择电站：</label>
      <select id="plant-select" v-model="selectedPlantId" @change="onPlantChange">
        <option v-for="plant in plantList" :key="plant.id" :value="plant.id">
          {{ plant.plantName }}
        </option>
      </select>
    </div>
    <div class="content">
      <!-- 能流图 -->
      <div class="chart-container energy-flow-container">
        <div ref="energyFlowChart" class="chart"></div>
      </div>

      <!-- 统计图 -->
      <div class="chart-container" style="padding-bottom: 5% !important;">
        <div ref="statsChart" class="chart"></div>
      </div>

      <!-- 实体数据折叠框组件 -->
      <div class="entities-container">
        <h2 class="section-title">设备详情</h2>
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
              <div class="entity-value">{{ entity.value }}{{ entity.unit }}</div>
            </div>

            <h3 class="sub-section-title">子组实体</h3>
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
    </div>
  </div>
</template>

<script setup>
import {nextTick, onBeforeMount, onBeforeUnmount, onBeforeUpdate, onMounted, onUpdated, ref} from 'vue';
import * as echarts from 'echarts';
import '@mdi/font/css/materialdesignicons.css';
import EnergyFlowCanvas from './energy-flow-canvas';
import {getPlantVos, getStatusNow, getEnergyFlowData, getDeviceBySn} from '../services/api';

onBeforeMount(() => {
  console.log('[ha-vue-card] 组件即将挂载');
  // 获取电站列表并初始化数据
  initializeData();
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
    await fetchEnergyFlowData();
    
    // 2. 更新图表
    await updateCharts();
    
    // 3. 更新实体数据
    await updateEntityGroups();
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
    
    // 1. 首先获取电站列表
    await fetchPlantList();
    
    if (plantList.value.length > 0) {
      // 2. 获取能流图数据（包含设备SN等信息）
      await fetchEnergyFlowData();
      
      // 3. 初始化图表
      nextTick(() => {
        initCharts();
      });
      
      // 4. 获取设备详情并更新实体数据
      await updateEntityGroups();
    } else {
      console.error('[ha-vue-card] 无可用电站');
    }
  } catch (error) {
    console.error('[ha-vue-card] 初始化数据失败:', error);
  }
};

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
        emType: energyFlowData.emType || ''
        // 其他设备信息...
      };
      
      // 保存batSn值，以便后续使用
      currentBatSn.value = energyFlowData.batSn || '';
      console.log("[ha-vue-card] 更新batSn:", currentBatSn.value);
      
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
      selectedPlantId.value = plantList.value[0].id;
      console.log('[ha-vue-card] 默认选中电站:', selectedPlantId.value);
    }
  } catch (error) {
    console.error('[ha-vue-card] 获取电站列表失败:', error);
    plantList.value = [];
  }
};

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

// 定义需要观察的属性
const observedAttributes = ['hass', 'config'];

// 获取观察的属性列表
const getObservedAttributes = () => observedAttributes;
const attributeChangedCallback = (name, oldValue, newValue) => {
  console.log(`[ha-vue-card] 属性${name}已更新:`, oldValue, '->', newValue);
};

const name = ref(props.config.name || 'AECC能管系统仪表盘');
const energyFlowChart = ref(null);
const statsChart = ref(null);

const simulatedData = ref({});
const links = ref([]); // 用于存储能流图的连接线数据
const nodes = ref([]); // 用于存储能流图的节点数据

// 电站相关数据
const plantList = ref([]);
const selectedPlantId = ref('');
const currentBatSn = ref(''); // 存储当前电池设备序列号
const entityGroups = ref([
  {
    name: '传感器组',
    expanded: false,
    entities: [
      { id: 'sensor.temp_1', description: '客厅温度', value: '25', unit: '°C' },
      { id: 'sensor.hum_1', description: '客厅湿度', value: '60', unit: '%' }
    ],
    subGroups: [
      {
        name: '温度传感器',
        expanded: false,
        entities: [
          { id: 'sensor.temp_2', description: '卧室温度', value: '24', unit: '°C' },
          { id: 'sensor.temp_3', description: '厨房温度', value: '26', unit: '°C' }
        ]
      },
      {
        name: '湿度传感器',
        expanded: false,
        entities: [
          { id: 'sensor.hum_2', description: '卧室湿度', value: '55', unit: '%' },
          { id: 'sensor.hum_3', description: '厨房湿度', value: '65', unit: '%' }
        ]
      }
    ]
  },
  {
    name: '开关组',
    expanded: false,
    entities: [
      { id: 'switch.main_1', description: '总开关', value: 'on', unit: '' }
    ],
    subGroups: [
      {
        name: '照明开关',
        expanded: false,
        entities: [
          { id: 'switch.light_1', description: '客厅灯', value: 'off', unit: '' },
          { id: 'switch.light_2', description: '卧室灯', value: 'on', unit: '' }
        ]
      },
      {
        name: '电器开关',
        expanded: false,
        entities: [
          { id: 'switch.tv', description: '电视', value: 'off', unit: '' },
          { id: 'switch.ac', description: '空调', value: 'on', unit: '' }
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
      // 初始化后立即更新图表数据
      updateCharts();
    });
  }

  // 初始化后立即更新数据
  // 使用setTimeout确保DOM完全渲染后再更新图表
  setTimeout(() => {
    updateCharts();
  }, 100);
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
const updateCharts = async () => {
  // 动态数据生成方法 (暂时注释掉，使用下面的模拟数据)

  // 首先尝试获取能源流向数据以获取batSn
  try {
    const energyFlowData = await getEnergyFlowData(selectedPlantId.value);
    if (energyFlowData?.batSn) {
      currentBatSn.value = energyFlowData.batSn;
      console.log("[ha-vue-card] 更新batSn:", currentBatSn.value);
    }
  } catch (error) {
    console.error("[ha-vue-card] 获取batSn失败:", error);
  }

  // 更新能流图
  if (energyChart && energyFlowChart.value) {
    // --- 模拟功率数据 ---
    if(currentBatSn.value){
      simulatedData.value = {
        gridPower: -500,    // 模拟向电网送电 500W
        solarPower: 2000,   // 模拟光伏发电 2000W
        batPower: 800,     // 模拟电池放电 800W (如果为负，则是充电)
        loadPower: 1000,    // 模拟家庭基础负载 1000W
        chargerPower: 700, // 模拟充电桩功率 700W
        smartPower: 600    // 模拟负载功率 600W
      };
    }

    let gridPower = simulatedData.value.gridPower;
    let solarPower = simulatedData.value.solarPower;
    let batPower = simulatedData.value.batPower;
    let loadPower = simulatedData.value.loadPower;
    let chargerPower = simulatedData.value.chargerPower;
    let smartPower = simulatedData.value.smartPower;
    const totalHomeLoad = loadPower + chargerPower + smartPower; // 计算总负载

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
       if (name === '电网') key = 'grid';
       else if (name === '光伏') key = 'solar';
       else if (name === '电池') key = 'battery';
       else if (name === '家庭负载') key = 'home';
       else if (name === '充电桩') key = 'charger';
       else if (name === '负载') key = 'smart';
       else key = name.toLowerCase();
      const ratio = positionRatios[key];
      return ratio ? calculatePosition(ratio[0], ratio[1]) : calculatePosition(0.5, 0.5);
    };
    if (nodes.value){
    // --- 更新节点数据 (使用模拟功率) ---
       nodes.value = [
       {
        name: '电网',
         power: gridPower,
        value: `${gridPower.toFixed(1)} W`,
        ...getPositionByName('电网'),
        color: '#673AB7', // 紫色
        icon: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZD0iTTEyIDJ2NC4wM0E4IDggMCAwIDAgNi4wNCAxMkgydjJoNC4wM0E4IDggMCAwIDAgMTIgMTkuOTZWMjRoMnYtNC4wM0E4IDggMCAwIDAgMTkuOTYgMTRIMjR2LTJoLTQuMDNBOCA4IDAgMCAwIDE0IDYuMDRWMmgtMnptLTIgMTBhMiAyIDAgMSAxIDIgMiAyIDIgMCAwIDEtMi0yeiIgZmlsbD0iIzY3M0FCNyIvPjwvc3ZnPg==',
        // workMode 由你之后动态传入
        workMode: gridPower > 0 ? -1 : 1 // 模拟：>0买电(输入), <0卖电(输出)
      },
      {
        name: '光伏',
        power: solarPower,
         // 只显示光伏功率
        value: `${solarPower.toFixed(1)} W`,
        ...getPositionByName('光伏'),
        color: '#FF9800', // 橙色
        icon: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZD0iTTMuNSAxOGgxN3YyaC0xN3YtMnptMTctMTJoMnYxMGgtMlY2em0tNCAzaDJ2N2gtMlY5em0tNCAtM2gydjEwaC0yVjZ6bS00IDZoMnY0aC0ydi00em0tNCAtM2gydjdIM1Y5eiIgZmlsbD0iI0ZGOTgwMCIvPjwvc3ZnPg==',
        workMode: 1 // 光伏总是发电 (输出)
      },
      {
        name: '电池',
        power: batPower,
        value: `${batPower > 0 ? `放电: ${batPower.toFixed(1)} W` : `充电: ${Math.abs(batPower).toFixed(1)} W`}`,
        ...getPositionByName('电池'),
        color: '#00BCD4', // 青色
        icon: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZD0iTTE2IDEwSDh2NEgxNnYtNHptLjY3LThIMTVWMGgtNnYySDcuMzNBMS4zMyAxLjMzIDAgMCAwIDYgMy4zM3YxNy4zNGMwIC43My42IDEuMzMgMS4zMyAxLjMzaDkuMzRjLjczIDAgMS4zMy0uNiAxLjMzLTEuMzNWMy4zM0ExLjMzIDEuMzMgMCAwIDAgMTYuNjcgMnoiIGZpbGw9IiMwMEJDRDQiLz48L3N2Zz4=',
         // workMode 由你之后动态传入
        workMode: batPower > 0 ? 1 : (batPower < 0 ? -1 : 0) // 模拟：放电(输出)/充电(输入)/静止
      },
      {
        name: '家庭负载',
        power: totalHomeLoad,
         value: `总计: ${totalHomeLoad.toFixed(1)} W`, // 只显示总负载功率
        ...getPositionByName('家庭负载'),
        // color: '#F44336', // 改为红色，表示消耗
        color: '#00BCD4', // 保持原来的青色
        icon: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZD0iTTEyIDNMNCAxMHYxMmgxNlYxMGwtOC03em02IDE0aC0zdi01aC02djVINnYtN2w2LTUgNiA1djd6IiBmaWxsPSIjMDBCQ0Q0Ii8+PC9zdmc+', // 家庭图标
        workMode: -1 // 负载总是输入
      },
      {
        name: '充电桩',
        power: chargerPower,
         // 只显示充电桩功率
        value: `${chargerPower.toFixed(1)} W`,
        ...getPositionByName('充电桩'),
        color: '#4CAF50', // 绿色
        icon: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZD0iTTEyIDE4SDZWMmgxNHYxNmgtOHptMi01aDJ2LTJoMlY5aC0yVjdoLTJ2MmgtdmwtNC45IDloNi45eiIgZmlsbD0iIzRDQUY1MCIvPjwvc3ZnPg==',
        workMode: chargerPower>0?-1:0 // 负载总是输入
      },
      {
        name: '负载',
        power: smartPower,
         // 只显示负载功率
        value: `${smartPower.toFixed(1)} W`,
        ...getPositionByName('负载'),
        color: '#FF5722', // 红色
        icon: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZD0iTTUgM3YxNmgxNlYzSDV6bTE0IDE0SDdWNWgxMnYxMnptLTctMWgyek0xNSA4aDJ2OGgtMlY4ek0xMSA4aDJ2M2gtMnYtM3ptMCA1aDJ2M2gtMnYtM3pNNyA4aDJ2MkgzVjhoNHY1eiIgZmlsbD0iI0ZGNTcyMiIvPjwvc3ZnPg==',
        workMode: smartPower>0?-1:0, // 负载总是输入
      }
    ];
    }
    // --- 创建包含所有路径的静态 links 数组 (用于测试) ---
    // 颜色根据能量源确定
    if (links.value){
      links.value = [
        // 从光伏出发 (橙色)
        { source: '光伏', target: '家庭负载', value: 800, color: '#FF9800' }, // 曲线
        { source: '光伏', target: '电池', value: 700, color: '#FF9800' },     // 直线
        { source: '光伏', target: '电网', value: 500, color: '#FF9800' },     // 曲线 (模拟卖给电网)

        // 从电池出发 (青色) - 假设电池正在放电 (batPower > 0)
        { source: '电池', target: '家庭负载', value: 400, color: '#00BCD4' }, // 曲线
        { source: '电池', target: '电网', value: 400, color: '#00BCD4' },     // 曲线 (模拟卖给电网)

        // 从电网出发 (紫色) - 假设电网需要供电给电池 (模拟 gridPower > 0 或需要充电)
        // 如果 gridPower < 0 (如模拟数据)，这条线理论上不该出现，但为了测试显示，我们强制画一个
        // 更好的模拟是让 gridPower > 0, batPower < 0
        { source: '电网', target: '家庭负载', value: 300, color: '#673AB7' }, // 曲线 (假设电网给负载供电)
        { source: '电网', target: '电池', value: 200, color: '#673AB7' },     // 曲线 (假设电网给电池充电)

        // 从家庭负载出发 (到子负载，颜色匹配子负载)
        { source: '家庭负载', target: '充电桩', value: chargerPower, color: '#4CAF50' }, // 直线 (绿色)
        { source: '家庭负载', target: '负载', value: smartPower, color: '#FF5722' }  // 直线 (红色)
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
        const powerData = await getStatusNow(selectedPlantId.value, (currentBatSn.value?currentBatSn.value:''));
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
              title: { text: '功率曲线', left: 'center', top: 0, textStyle: { fontSize: 16 } },
              tooltip: { 
                trigger: 'axis',
                formatter: function(params) {
                  let result = params[0].axisValue + '<br/>';
                  params.forEach(param => {
                    result += param.marker + param.seriesName + ': ' + param.value + ' W<br/>';
                  });
                  return result;
                }
              },
              legend: { 
                data: ['光伏功率', '电网功率', '电池功率', '负载功率'], 
                bottom: 0, 
                itemWidth: 15, 
                itemHeight: 10, 
                textStyle: { fontSize: 12 } 
              },
              grid: { left: '3%', right: '4%', bottom: '15%', top: '15%', containLabel: true },
              xAxis: { 
                type: 'category', 
                data: times, 
                axisLabel: { 
                  // 只显示部分时间点标签
                  interval: Math.max(Math.floor(times.length / 12), 1),
                  rotate: 45, 
                  fontSize: 10 
                },
                // 确保x轴可以显示指示器
                axisPointer: {
                  show: true,
                  label: {
                    show: true
                  }
                }
              },
              yAxis: { 
                type: 'value', 
                name: '功率 (W)', 
                nameTextStyle: { fontSize: 12 }, 
                axisLabel: { fontSize: 10 } 
              },
              series: [
                { 
                  name: '光伏功率', 
                  type: 'line', 
                  data: solarPowerData, 
                  smooth: true, 
                  symbol: 'circle', 
                  // 显示所有数据点
                  showSymbol: true,
                  symbolSize: 5, 
                  // 移除采样以显示所有点
                  sampling: 'none',
                  itemStyle: { color: '#FF9800' }, 
                  areaStyle: { opacity: 0.2 },
                  lineStyle: { width: 2, color: '#FF9800' } 
                },
                { 
                  name: '电网功率', 
                  type: 'line', 
                  data: gridPowerData, 
                  smooth: true, 
                  symbol: 'circle', 
                  showSymbol: true,
                  symbolSize: 5, 
                  sampling: 'none',
                  itemStyle: { color: '#673AB7' }, 
                  areaStyle: { opacity: 0.2 },
                  lineStyle: { width: 2, color: '#673AB7' } 
                },
                { 
                  name: '电池功率', 
                  type: 'line', 
                  data: batPowerData, 
                  smooth: true, 
                  symbol: 'circle', 
                  showSymbol: true,
                  symbolSize: 5, 
                  sampling: 'none',
                  itemStyle: { color: '#00BCD4' }, 
                  areaStyle: { opacity: 0.2 },
                  lineStyle: { width: 2, color: '#00BCD4' } 
                },
                { 
                  name: '负载功率', 
                  type: 'line', 
                  data: loadPowerData, 
                  smooth: true, 
                  symbol: 'circle', 
                  showSymbol: true,
                  symbolSize: 5, 
                  sampling: 'none',
                  itemStyle: { color: '#F44336' }, 
                  areaStyle: { opacity: 0.2 },
                  lineStyle: { width: 2, color: '#F44336' } 
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
            title: { text: '功率曲线 (模拟数据)', left: 'center', top: 0, textStyle: { fontSize: 16 } },
            tooltip: { trigger: 'axis', formatter: p => p.map(i => `${i.seriesName}: ${i.value} W`).join('<br/>') },
            legend: { data: ['电池功率', '光伏功率', '电网功率', '负载功率'], bottom: 0, itemWidth: 15, itemHeight: 10, textStyle: { fontSize: 12 } },
            grid: { left: '3%', right: '4%', bottom: '15%', top: '15%', containLabel: true },
            xAxis: { type: 'category', data: timeCategories, axisLabel: { interval: 0, rotate: 30, fontSize: 10 } },
            yAxis: { type: 'value', name: '功率 (W)', nameTextStyle: { fontSize: 12 }, axisLabel: { fontSize: 10 } },
            series: [
              { name: '电池功率', type: 'line', data: mockData.battery, smooth: true, symbol: 'circle', symbolSize: 8, itemStyle: { color: '#00BCD4' }, lineStyle: { width: 3, color: '#00BCD4' } },
              { name: '光伏功率', type: 'line', data: mockData.solar, smooth: true, symbol: 'circle', symbolSize: 8, itemStyle: { color: '#FF9800' }, lineStyle: { width: 3, color: '#FF9800' } },
              { name: '电网功率', type: 'line', data: mockData.grid, smooth: true, symbol: 'circle', symbolSize: 8, itemStyle: { color: '#673AB7' }, lineStyle: { width: 3, color: '#673AB7' } },
              { name: '负载功率', type: 'line', data: mockData.load, smooth: true, symbol: 'circle', symbolSize: 8, itemStyle: { color: '#F44336' }, lineStyle: { width: 3, color: '#F44336' } }
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
    // 首先获取能源流向数据，提取设备基本信息
    const energyFlowData = await getEnergyFlowData(selectedPlantId.value);
    
    if (energyFlowData) {
      // 保存设备基本信息
      deviceInfo.value = {
        emSn: energyFlowData.emSn || '',
        emType: energyFlowData.emType || '',
        batSn: energyFlowData.batSn || '',
        batType: energyFlowData.batType || ''
      };
      
      console.log("[ha-vue-card] 提取设备信息:", deviceInfo.value);
      
      // 获取逆变器详细信息
      if (deviceInfo.value.emSn && deviceInfo.value.emType) {
        try {
          const inverterInfo = await getDeviceBySn(deviceInfo.value.emType, deviceInfo.value.emSn);
          deviceDetailInfo.value.inverter = inverterInfo;
          console.log("[ha-vue-card] 获取逆变器详细信息:", inverterInfo);
        } catch (error) {
          console.error("[ha-vue-card] 获取逆变器详细信息失败:", error);
        }
      }
      
      // 获取电池详细信息
      if (deviceInfo.value.batSn && deviceInfo.value.batType) {
        try {
          const batteryInfo = await getDeviceBySn(deviceInfo.value.batType, deviceInfo.value.batSn);
          deviceDetailInfo.value.battery = batteryInfo;
          console.log("[ha-vue-card] 获取电池详细信息:", batteryInfo);
        } catch (error) {
          console.error("[ha-vue-card] 获取电池详细信息失败:", error);
        }
      }
      
      // 更新实体组数据
      updateEntityGroupsFromDeviceInfo();
    }
  } catch (error) {
    console.error("[ha-vue-card] 更新实体数据失败:", error);
  }
};

// 从设备信息更新实体组
const updateEntityGroupsFromDeviceInfo = () => {
  // 创建新的实体组
  const newGroups = [
    {
      name: '逆变器设备组',
      expanded: false,
      entities: [], // 基本信息
      subGroups: generateInverterSubGroups()
    },
    {
      name: '电池设备组',
      expanded: false,
      entities: [], // 基本信息
      subGroups: generateBatterySubGroups()
    }
  ];
  
  // 添加设备基本信息到主组
  newGroups[0].entities = [
    { id: 'inverter.sn', description: '逆变器序列号', value: deviceInfo.value.emSn || '未知', unit: '' },
    { id: 'inverter.type', description: '逆变器型号', value: deviceInfo.value.emType || '未知', unit: '' }
  ];
  
  newGroups[1].entities = [
    { id: 'battery.sn', description: '电池序列号', value: deviceInfo.value.batSn || '未知', unit: '' },
    { id: 'battery.type', description: '电池型号', value: deviceInfo.value.batType || '未知', unit: '' }
  ];
  
  // 更新实体组
  entityGroups.value = newGroups;
};

// 生成逆变器子组
const generateInverterSubGroups = () => {
  const subGroups = [];
  
  if (deviceDetailInfo.value.inverter && deviceDetailInfo.value.inverter.deviceInfoMap) {
    const deviceInfoMap = deviceDetailInfo.value.inverter.deviceInfoMap;
    
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
            id: `inverter.${category}.${key}`,
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

// 生成电池子组
const generateBatterySubGroups = () => {
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

// Home Assistant Web Component 生命周期方法
const setConfig = (config) => {
  console.log('[ha-vue-card] setConfig被调用', config);
  if (config) {
    console.log('[ha-vue-card] 当前配置:', config);
    name.value = config.name || 'Vue Card';
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
    case 'sensor': return 'mdi-thermometer';
    case 'switch': return 'mdi-power';
    case 'light': return 'mdi-lightbulb';
    case 'climate': return 'mdi-thermostat';
    default: return 'mdi-help-circle';
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
  bat: null,   // 电池详细信息
  load: null, // 负载详细信息
  charger: null, // 充电桩详细信息
  em: null, // 电表详细信息
  solar: null, // 太阳能详细信息
  grid: null, // 电网详细信息
});

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
  }

  .chart {
    padding: 8px;
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
</style>
