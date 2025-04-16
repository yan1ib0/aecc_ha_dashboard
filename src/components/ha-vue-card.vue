<template>
  <div class="panel">
    <!-- 新增：电站选择卡片区域 -->
    <div class="plant-selector-card" style="margin-bottom: 16px;">
      <label for="plant-select">选择电站：</label>
      <select id="plant-select" v-model="selectedPlantId" @change="onPlantChange">
        <option v-for="plant in plantList" :key="plant.id" :value="plant.id">
          {{ plant.plantName }}
        </option>
      </select>
    </div>
    <h1>{{ name }}</h1>
    <div class="content">
      <!-- 能流图 -->
      <div class="chart-container energy-flow-container">
        <div ref="energyFlowChart" class="chart"></div>
      </div>

      <!-- 统计图 -->
      <div class="chart-container" style="padding-bottom: 80% !important;">
        <div ref="statsChart" class="chart"></div>
      </div>

      <!-- 实体数据折叠框组件 -->
      <div class="entities-container">
        <h2 class="section-title">实体数据</h2>
        <div v-for="(group, groupIndex) in entityGroups" :key="groupIndex" class="entity-group">
          <div class="group-header" @click="toggleGroup(groupIndex)">
            <span>{{ group.name }}</span>
            <span class="arrow" :class="{ 'expanded': group.expanded }">▼</span>
          </div>
          <div v-if="group.expanded" class="group-content">
            <h3 class="sub-section-title">主组实体</h3>
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
import { ref, onMounted, onUpdated, onUnmounted, onBeforeMount, onBeforeUpdate, onBeforeUnmount } from 'vue';
import * as echarts from 'echarts';
import '@mdi/font/css/materialdesignicons.css';
import EnergyFlowCanvas from './energy-flow-canvas';
import { getPlantVos, getDeviceAllListByPlantId } from '../services/api';

onBeforeMount(() => {
  console.log('[ha-vue-card] 组件即将挂载');
});

onMounted(() => {
  console.log('[ha-vue-card] 组件已挂载');
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

  // 获取电站列表
  fetchPlantList();

  initCharts();
  updateEntityGroups();

  // 添加窗口大小变化监听
  window.addEventListener('resize', handleResize);

  // 设置定时器，每分钟更新设备信息
  startDeviceUpdateTimer();
});

onBeforeUpdate(() => {
  console.log('[ha-vue-card] 组件即将更新');
});

onUpdated(() => {
  console.log('[ha-vue-card] 组件已更新');
});

onBeforeUnmount(() => {
  console.log('[ha-vue-card] 组件即将卸载');
});

onUnmounted(() => {
  console.log('[ha-vue-card] 组件已卸载');
  // 移除窗口大小变化监听
  window.removeEventListener('resize', handleResize);
  // 销毁图表实例
  if (energyChart) {
    energyChart.dispose();
    energyChart = null;
  }
  if (statChart) {
    statChart.dispose();
    statChart = null;
  }

  // 清除设备更新定时器
  if (deviceUpdateTimer) {
    clearInterval(deviceUpdateTimer);
    deviceUpdateTimer = null;
  }
});

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

// 电站相关数据
const plantList = ref([]);
const selectedPlantId = ref('');
const currentDeviceList = ref([]);
let deviceUpdateTimer = null;
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

// const toggleGroup = (index) => {
//   entityGroups.value[index].expanded = !entityGroups.value[index].expanded;
// };

let energyChart = null;
let statChart = null;

const initCharts = () => {
  // 初始化能流图
  if (energyFlowChart.value) {
    energyChart = new EnergyFlowCanvas(energyFlowChart.value);

    // 确保容器尺寸正确设置
    const containerWidth = energyFlowChart.value.clientWidth;
    const containerHeight = containerWidth * 2 / 3;
    energyFlowChart.value.style.height = `${containerHeight}px`;
  }

  // 初始化统计图
  if (statsChart.value) {
    statChart = echarts.init(statsChart.value);
  }

  // 初始化后立即更新数据
  // 使用setTimeout确保DOM完全渲染后再更新图表
  setTimeout(() => {
    updateCharts();
  }, 100);
};

const handleResize = () => {
  if (energyChart) {
    // 确保容器尺寸正确设置
    const containerWidth = energyFlowChart.value.clientWidth;
    const containerHeight = containerWidth * 2 / 3;
    energyFlowChart.value.style.height = `${containerHeight}px`;

    energyChart.resize();
    updateCharts(); // 重新绘制图表
  }
  if (statChart) {
    statChart.resize();
  }
};

// 获取电站列表
const fetchPlantList = async () => {
  try {
    const response = await getPlantVos();
    plantList.value = response;
    // 如果有电站数据，默认选择第一个
    if (plantList.value.length > 0 && !selectedPlantId.value) {
      selectedPlantId.value = plantList.value[0].id;
      // 获取选中电站的设备列表
      fetchDeviceList(selectedPlantId.value);
    }
  } catch (error) {
    console.error('[ha-vue-card] 获取电站列表异常:', error);
  }
};

// 获取设备列表
const fetchDeviceList = async (plantId) => {
  if (!plantId) return;

  try {
    const response = await getDeviceAllListByPlantId(plantId);
    // 缓存当前电站的设备列表
    currentDeviceList.value = response;
    console.log('[ha-vue-card] 当前电站设备列表:', currentDeviceList.value);
    // 更新图表数据
    updateCharts();
  } catch (error) {
    console.error('[ha-vue-card] 获取设备列表异常:', error);
  }
};

// 电站选择变化处理
const onPlantChange = () => {
  console.log('[ha-vue-card] 选择电站变更为:', selectedPlantId.value);
  // 获取选中电站的设备列表
  fetchDeviceList(selectedPlantId.value);
};

// 启动设备信息更新定时器
const startDeviceUpdateTimer = () => {
  // 清除已存在的定时器
  if (deviceUpdateTimer) {
    clearInterval(deviceUpdateTimer);
  }

  // 每分钟更新一次设备信息
  deviceUpdateTimer = setInterval(() => {
    if (selectedPlantId.value) {
      console.log('[ha-vue-card] 定时更新设备信息');
      fetchDeviceList(selectedPlantId.value);
    }
  }, 60 * 1000); // 60秒 = 1分钟
};

const updateCharts = () => {
  // 更新能流图
  if (energyChart) {
    const containerWidth = energyFlowChart.value.clientWidth;
    const containerHeight = containerWidth * 2 / 3; // 保持3:2宽高比

    // 计算节点位置的函数，使用比例而不是固定值
    const calculatePosition = (xRatio, yRatio) => {
      return {
        x: containerWidth * xRatio,
        y: containerHeight * yRatio
      };
    };

    // 定义六个节点的位置比例
    const positionRatios = {
      'solar': [0.5, 0.25],    // 光伏位置（左侧）
      'grid': [0.15, 0.5],     // 电网位置（左下）
      'home': [0.85, 0.5],     // 家庭负载位置（右上）
      'charger': [0.85, 0.25], // 充电桩位置（右上角）
      'battery': [0.5, 0.75],   // 电池位置（中下）
      'smart': [0.85, 0.75]      // 智能负载位置（右下）
    };

    // 根据比例计算实际位置
    const getPositionByName = (name) => {
      const ratio = positionRatios[name.toLowerCase().replace(/[\u4e00-\u9fa5]/g, '')];
      return ratio ? calculatePosition(ratio[0], ratio[1]) : { x: 0, y: 0 };
    };

    // 根据参考图调整节点位置
    const nodes = [
      {
        name: '光伏',
        value: '0W',
        ...getPositionByName('solar'),
        color: '#FF9800',
        icon: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZD0iTTMuNSAxOGgxN3YyaC0xN3YtMnptMTctMTJoMnYxMGgtMlY2em0tNCAzaDJ2N2gtMlY5em0tNCAtM2gydjEwaC0yVjZ6bS00IDZoMnY0aC0ydi00em0tNCAtM2gydjdIM1Y5eiIgZmlsbD0iI0ZGOTgwMCIvPjwvc3ZnPg=='
      },
      {
        name: '电网',
        value: '-5W\n+0W',
        ...getPositionByName('grid'),
        color: '#673AB7',
        icon: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZD0iTTEyIDJ2NC4wM0E4IDggMCAwIDAgNi4wNCAxMkgydjJoNC4wM0E4IDggMCAwIDAgMTIgMTkuOTZWMjRoMnYtNC4wM0E4IDggMCAwIDAgMTkuOTYgMTRIMjR2LTJoLTQuMDNBOCA4IDAgMCAwIDE0IDYuMDRWMmgtMnptLTIgMTBhMiAyIDAgMSAxIDIgMiAyIDIgMCAwIDEtMi0yeiIgZmlsbD0iIzY3M0FCNyIvPjwvc3ZnPg=='
      },
      {
        name: '家庭负载',
        value: '10W',
        ...getPositionByName('home'),
        color: '#00BCD4',
        icon: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZD0iTTEyIDNMNCAxMHYxMmgxNlYxMGwtOC03em02IDE0aC0zdi01aC02djVINnYtN2w2LTUgNiA1djd6IiBmaWxsPSIjMDBCQ0Q0Ii8+PC9zdmc+'
      },
      {
        name: '充电桩',
        value: '0W',
        ...getPositionByName('charger'),
        color: '#4CAF50',
        icon: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZD0iTTEyIDE4SDZWMmgxNHYxNmgtOHptMi01aDJ2LTJoMlY5aC0yVjdoLTJ2MmgtdmwtNC45IDloNi45eiIgZmlsbD0iIzRDQUY1MCIvPjwvc3ZnPg=='
      },
      {
        name: '电池',
        value: '-0W\n+10W',
        ...getPositionByName('battery'),
        color: '#00BCD4',
        icon: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZD0iTTE2IDEwSDh2NEgxNnYtNHptLjY3LThIMTVWMGgtNnYySDcuMzNBMS4zMyAxLjMzIDAgMCAwIDYgMy4zM3YxNy4zNGMwIC43My42IDEuMzMgMS4zMyAxLjMzaDkuMzRjLjczIDAgMS4zMy0uNiAxLjMzLTEuMzNWMy4zM0ExLjMzIDEuMzMgMCAwIDAgMTYuNjcgMnoiIGZpbGw9IiMwMEJDRDQiLz48L3N2Zz4='
      },
      {
        name: '智能负载',
        value: '0W',
        ...getPositionByName('smart'),
        color: '#FF5722',
        icon: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZD0iTTUgM3YxNmgxNlYzSDV6bTE0IDE0SDdWNWgxMnYxMnptLTctMWgyek0xNSA4aDJ2OGgtMlY4ek0xMSA4aDJ2M2gtMnYtM3ptMCA1aDJ2M2gtMnYtM3pNNyA4aDJ2MkgzVjhoNHY1eiIgZmlsbD0iI0ZGNTcyMiIvPjwvc3ZnPg=='
      }
    ];

    const links = [
      // 从电网到家庭负载的连线
      { source: '电网', target: '家庭负载', value: 600, color: '#673AB7', curveness: 0 },

      // 从光伏出发的连线
      { source: '光伏', target: '家庭负载', value: 1500, color: '#FF9800', curveness: 0 },
      { source: '光伏', target: '电池', value: 800, color: '#FF9800', curveness: 0 },
      { source: '光伏', target: '电网', value: 200, color: '#FF9800', curveness: 0 },

      // 从家庭负载出发的连线
      { source: '家庭负载', target: '充电桩', value: 500, color: '#00BCD4', curveness: 0 },
      { source: '家庭负载', target: '智能负载', value: 300, color: '#00BCD4', curveness: 0 },

      // 从电池出发的连线
      { source: '电池', target: '家庭负载', value: 1200, color: '#00BCD4', curveness: 0 },
      { source: '电池', target: '电网', value: 300, color: '#00BCD4', curveness: 0 }
    ];

    // 设置粒子速度因子
    energyChart.setParticleSpeed(0.15);

    // 修改拐弯路径的控制点
    energyChart.setCustomControlPoints({
      '光伏-家庭负载': { offset: { x: 0.3, y: 0.1 } },
      '光伏-电网': { offset: { x: -0.3, y: -0.1 } },
      '电池-家庭负载': { offset: { x: 0.3, y: -0.1 } },
      '电池-电网': { offset: { x: -0.3, y: 0.1 } }
    });

    // 强制更新Canvas尺寸后再设置数据
    energyChart.resize();
    energyChart.setData(nodes, links);
  }

  // 更新统计图
  if (statChart) {
    // 模拟时间序列数据
    const timeCategories = ['00:00', '03:00', '06:00', '09:00', '12:00', '15:00', '18:00', '21:00'];
    const mockData = {
      battery: [1200, 1800, 2200, 2500, 2000, 1500, 1000, 800],
      solar: [0, 500, 2000, 3500, 3500, 2500, 2000, 500],
      grid: [1500, 1200, 800, 500, 700, 800, 1200, 1800],
      load: [2000, 2500, 2800, 3000, 3200, 3000, 2500, 2000]
    };

    statChart.setOption({
      title: {
        text: '功率曲线',
        left: 'center',
        top: 0,
        textStyle: {
          fontSize: 16
        }
      },
      tooltip: {
        trigger: 'axis',
        formatter: function (params) {
          return params.map(item => {
            return `${item.seriesName}: ${item.value} W`;
          }).join('<br/>');
        }
      },
      legend: {
        data: ['电池储能功率', '光伏功率', '电网功率', '负载功率'],
        bottom: 0,
        itemWidth: 15,
        itemHeight: 10,
        textStyle: {
          fontSize: 12
        }
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '15%',
        top: '15%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: timeCategories,
        axisLabel: {
          interval: 0,
          rotate: 30,
          fontSize: 10
        }
      },
      yAxis: {
        type: 'value',
        name: '功率 (W)',
        nameTextStyle: {
          fontSize: 12
        },
        axisLabel: {
          fontSize: 10
        }
      },
      series: [
        {
          name: '电池储能功率',
          type: 'line',
          data: mockData.battery,
          smooth: true,
          symbol: 'circle',
          symbolSize: 8,
          itemStyle: { color: '#4CAF50' },
          lineStyle: { width: 3, color: '#4CAF50' }
        },
        {
          name: '光伏功率',
          type: 'line',
          data: mockData.solar,
          smooth: true,
          symbol: 'circle',
          symbolSize: 8,
          itemStyle: { color: '#FF9800' },
          lineStyle: { width: 3, color: '#FF9800' }
        },
        {
          name: '电网功率',
          type: 'line',
          data: mockData.grid,
          smooth: true,
          symbol: 'circle',
          symbolSize: 8,
          itemStyle: { color: '#2196F3' },
          lineStyle: { width: 3, color: '#2196F3' }
        },
        {
          name: '负载功率',
          type: 'line',
          data: mockData.load,
          smooth: true,
          symbol: 'circle',
          symbolSize: 8,
          itemStyle: { color: '#F44336' },
          lineStyle: { width: 3, color: '#F44336' }
        }
      ]
    });
  }
};

const updateEntityGroups = () => {
  if (props.hass && props.hass.states) {
    // 保留原有分组结构，只更新实体数据
    const newGroups = JSON.parse(JSON.stringify(entityGroups.value));

    // 按类型分组实体
    const groupedEntities = {};
    Object.entries(props.hass.states).forEach(([entityId, state]) => {
      const type = entityId.split('.')[0];
      if (!groupedEntities[type]) {
        groupedEntities[type] = [];
      }
      groupedEntities[type].push({
        id: entityId,
        description: state.attributes.friendly_name || entityId,
        type: type,
        value: state.state,
        unit: state.attributes.unit_of_measurement || ''
      });
    });

    // 将真实实体数据映射到预设分组结构中
    newGroups.forEach(group => {
      const type = group.name.replace('组', '').toLowerCase();
      if (groupedEntities[type]) {
        group.entities = groupedEntities[type];
      }

      // 处理子组
      if (group.subGroups) {
        group.subGroups.forEach(subGroup => {
          const subType = subGroup.name.replace('组', '').toLowerCase();
          if (groupedEntities[subType]) {
            subGroup.entities = groupedEntities[subType];
          }
        });
      }
    });

    entityGroups.value = newGroups;
    updateCharts();
  }
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

const updateName = () => {
  console.log('[ha-vue-card] 更新名称');
  name.value = 'New Name';
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
  height: auto;
  min-height: 250px;
  padding-bottom: 66.67% !important;
  /* 宽高比3:2 */
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

.energy-flow-container .chart {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
}

.chart-container:nth-child(2) .chart {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
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
    padding-bottom: 80% !important;
    /* 移动端调整宽高比 */
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