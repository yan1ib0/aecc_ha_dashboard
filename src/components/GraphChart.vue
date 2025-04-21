<template>
  <div ref="chartContainer" style="width: 600px; height: 600px;"></div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import * as echarts from 'echarts';
// 引入本地图标
import { localIcons, positions, nodeSize, fontSize, isMobile, flows } from '../assets/icons';

const chartContainer = ref(null);
let chart = null;

// 图表配置项
const getOption = () => ({
  // 图表标题配置
  title: {
    // text: 'ECharts Graph示例', // 主标题文本
    subtext: '能流图',     // 副标题文本
    top: 'top',              // 标题位置-顶部
    left: 'center'          // 标题水平居中
  },
  // 提示框配置
  tooltip: {
    trigger: 'item',        // 触发类型：数据项触发
    formatter: params => {
      return `功率: 800W `;  // 自定义提示框内容
    }
  },
  // 图例配置
  // legend: [
  //   {
  //     data: graphData.categories.map(category => category.name) // 图例数据，从categories中获取名称
  //   }
  // ],
  // 动画效果配置
  animationDuration: 1500,                 // 初始动画的时长
  animationEasingUpdate: 'quinticInOut',   // 数据更新动画的缓动效果

  // 系列列表配置
  series: [{
    name: '能流图',
    type: 'graph',         // 图表类型：关系图
    layout: 'none',        // 布局类型：不采用自动布局，使用手动指定的坐标
    data: [
      // Grid节点配置
      {
        name: 'Grid',
        symbolSize: nodeSize,
        symbol: `image://${localIcons.grid}`,
        itemStyle: { color: '#2196F3' },
        x: positions.grid[0], y: positions.grid[1],
        label: {
          show: true,
          position: 'bottom',
          fontSize: fontSize,
          fontWeight: 'bold',
          color: '#666'
        }
      },
      {
        name: 'Solar',
        symbolSize: nodeSize,
        symbol: `image://${localIcons.solar}`,
        itemStyle: { color: '#FF9800' },
        x: positions.solar[0], y: positions.solar[1],
        label: {
          show: true,
          position: 'bottom',
          fontSize: fontSize,
          fontWeight: 'bold',
          color: '#666'
        }
      },
      {
        name: 'Home Load',
        symbolSize: nodeSize,
        symbol: `image://${localIcons.home}`,
        itemStyle: { color: '#F44336' },
        x: positions.home[0], y: positions.home[1],
        label: {
          show: true,
          position: 'bottom',
          fontSize: fontSize,
          fontWeight: 'bold',
          color: '#666'
        }
      },
      {
        name: 'Charger',
        symbolSize: nodeSize,
        symbol: `image://${localIcons.charger}`,
        itemStyle: { color: '#4CAF50' },
        x: positions.charger[0], y: positions.charger[1],
        label: {
          show: true,
          position: 'bottom',
          fontSize: fontSize,
          fontWeight: 'bold',
          color: '#666'
        }
      },
      {
        name: 'Battery',
        symbolSize: nodeSize,
        symbol: `image://${localIcons.battery}`,
        itemStyle: { color: '#9C27B0' },
        x: positions.battery[0], y: positions.battery[1],
        label: {
          show: true,
          position: 'bottom',
          fontSize: fontSize,
          fontWeight: 'bold',
          color: '#666'
        }
      },
      {
        name: 'Load',
        symbolSize: nodeSize,
        symbol: `image://${localIcons.smart}`,
        itemStyle: { color: '#FF5722' },
        x: positions.smart[0], y: positions.smart[1],
        label: {
          show: true,
          position: 'bottom',
          fontSize: fontSize,
          fontWeight: 'bold',
          color: '#666'
        }
      }
    ],
    // 边的配置
    links: [],
    // 图表的全局配置
    roam: false,               // 是否开启鼠标缩放和平移漫游
    label: {
      show: true,              // 显示标签
      position: 'top',         // 标签位置
      fontSize: 14,            // 字体大小
      fontWeight: 'bold',      // 字体粗细
      color: '#666',           // 字体颜色
      backgroundColor: 'rgba(255, 255, 255, 0.8)', // 标签背景色
      padding: isMobile ? [2, 4] : [4, 8],        // 标签内边距
      borderRadius: 4          // 标签圆角
    },
    edgeSymbol: ['none', 'none'],    // 边两端的标记类型：无
    edgeSymbolSize: [0, 10],         // 边两端的标记大小
    lineStyle: {
      opacity: 0.8,            // 边的透明度
      width: 3,                // 边的宽度
      curveness: 0.3           // 边的曲度
    }
  }]
});

// 初始化图表
const initChart = () => {
  if (chartContainer.value) {
    chart = echarts.init(chartContainer.value);

    let option = getOption();
    flows.forEach(([source, target, color, symbol, curveness, value]) => {
      option.series.links.push({
        source,
        target,
        value,
        lineStyle: {
          color,
          width: Math.max(2, Math.min(6, value / 400)), // 根据功率调整线宽
          curveness: curveness,
          type: 'solid'
        },
        label: {
          show: false,
          // formatter: `${value}\n W`,
          padding: [1, 1],
          fontSize: 11,
          borderRadius: 2
        },
        effect: {
          show: true,
          period: Math.max(3, Math.min(6, 5000 / value)),
          trailLength: 0.7,
          symbolSize: Math.max(5, Math.min(12, value / 300)), // 根据功率调整动效大小
          symbol: symbol,
          color: color
        }
      });
    });
    chart.setOption(option);

    // 添加点击事件
    chart.on('click', params => {
      if (params.dataType === 'node') {
        console.log('点击节点:', params.data);
      } else if (params.dataType === 'edge') {
        console.log('点击边:', params.data);
      }
    });

    // 监听窗口大小变化
    window.addEventListener('resize', handleResize);
  }
};

// 处理窗口大小变化
const handleResize = () => {
  chart?.resize();
};

// 组件挂载时初始化图表
onMounted(() => {
  initChart();
});

// 组件卸载时清理事件监听
onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
  chart?.dispose();
});
</script>