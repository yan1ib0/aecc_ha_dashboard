import { getEnergyFlowData, getStatusNow, login, stopSessionRenewal } from '../services/api';

class EnergyFlowCanvas {
  constructor(container) {
    this.container = container;

    // 添加标题元素
    this.titleElement = document.createElement('div');
    this.titleElement.style.textAlign = 'center';
    this.titleElement.style.color = 'var(--primary-text-color)';
    this.titleElement.style.marginBottom = '16px';
    this.titleElement.textContent = '能流图';
    this.container.appendChild(this.titleElement);

    // 创建Canvas元素
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');

    // 设置Canvas样式
    this.canvas.style.width = '100%';
    this.canvas.style.height = 'auto';
    this.canvas.style.display = 'block';

    // 添加到容器
    this.container.appendChild(this.canvas);

    this.nodes = [];
    this.links = [];
    this.particles = [];
    this.animationFrameId = null;
    this.particleSpeedFactor = 1;
    this.nodeRadius = 30;  // 默认节点半径
    this.loadedIcons = new Map();
    this.lastUpdateTime = Date.now(); // 初始化上次更新时间戳
    this.customControlPoints = {}; // 添加自定义控制点配置

    // 初始化数据
    this.flowData = {
      pv_to_grid: 0,
      pv_to_battery: 0,
      pv_to_load: 0,
      battery_to_grid: 0,
      battery_to_load: 0,
      grid_to_battery: 0,
      grid_to_load: 0
    };

    // 初始化数据更新定时器
    this.dataRefreshInterval = null;

    // 登录并获取数据
    this.loginAndFetchData();

    // 启动数据更新定时器
    this.startDataRefreshTimer();

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  // 启动数据更新定时器
  startDataRefreshTimer() {
    // 清除已存在的定时器
    if (this.dataRefreshInterval) {
      clearInterval(this.dataRefreshInterval);
    }

    // 设置新的定时器
    this.dataRefreshInterval = setInterval(() => {
      this.fetchData();
    }, 60000); // 每分钟刷新一次
  }

  // 重新初始化数据
  reinitialize() {
    // 清除现有数据
    this.nodes = [];
    this.links = [];
    this.particles = [];
    this.loadedIcons.clear();

    // 重置流数据
    this.flowData = {
      pv_to_grid: 0,
      pv_to_battery: 0,
      pv_to_load: 0,
      battery_to_grid: 0,
      battery_to_load: 0,
      grid_to_battery: 0,
      grid_to_load: 0
    };

    // 重新获取数据并重启定时器
    this.loginAndFetchData();
    this.startDataRefreshTimer();
  }

  // 清理资源
  destroy() {
    // 清除定时器
    if (this.dataRefreshInterval) {
      clearInterval(this.dataRefreshInterval);
      this.dataRefreshInterval = null;
    }

    // 清除动画帧
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    // 移除事件监听
    window.removeEventListener('resize', () => this.resize());

    // 清除数据
    this.nodes = [];
    this.links = [];
    this.particles = [];
    this.loadedIcons.clear();
  }


  resize() {
    const rect = this.container.getBoundingClientRect();
    // 设置宽度为容器宽度
    const width = rect.width;
    // 计算高度为宽度的2/3，实现3:2的宽高比
    const height = Math.floor(width * 2 / 3);

    this.canvas.width = width;
    this.canvas.height = height;

    // 根据新的宽高比调整canvas样式
    this.canvas.style.width = '100%';
    this.canvas.style.height = `${height}px`;

    // 根据容器大小调整节点半径
    this.updateNodeRadius();

    this.draw();
  }

  updateNodeRadius() {
    const minDimension = Math.min(this.canvas.width, this.canvas.height);
    const widthFactor = this.canvas.width / 600;  // 基于标准宽度600px的缩放因子
    // 计算基础半径，整体增大节点
    const baseRadius = Math.min(25, Math.max(18, minDimension / 15));
    // 应用宽度因子，但限制最小和最大值
    this.nodeRadius = Math.max(18, Math.min(35, baseRadius * Math.sqrt(widthFactor)));
  }

  setParticleSpeed(speedFactor) {
    this.particleSpeedFactor = speedFactor > 0 ? speedFactor : 1;
    // 更新现有粒子的速度
    this.initParticles(); // 重新初始化以应用新的速度因子
  }

  /**
   * 设置节点和连接数据，并重新初始化粒子系统和绘制流程
   * @param {Array} nodes - 节点数据数组
   * @param {Array} links - 连接数据数组
   */
  setData(nodes, links) {
    this.nodes = nodes;
    this.links = links;
    this.loadIcons();
    this.initParticles();
    this.draw();
  }

  loadIcons() {
    this.nodes.forEach(node => {
      if (node.icon && !this.loadedIcons.has(node.name)) {
        const img = new Image();
        img.src = node.icon;
        img.onload = () => {
          this.loadedIcons.set(node.name, img);
          this.draw();
        };
      }
    });
  }

  initParticles() {
    this.particles = [];
    this.links.forEach(link => {
      // 只为可见且功率大于0的连接创建粒子
      if (!link.visible || link.value <= 0) return;

      const sourceNode = this.nodes.find(n => n.name === link.source);
      const targetNode = this.nodes.find(n => n.name === link.target);

      if (sourceNode && targetNode) {
        const dx = targetNode.x - sourceNode.x;
        const dy = targetNode.y - sourceNode.y;
        // 估算距离 - 对于曲线路径需要改进
        const estimatedDistance = Math.sqrt(dx * dx + dy * dy);

        // 根据功率调整粒子数量 (功率越大粒子越多)
        // 保持密度大致恒定
        const powerFactor = Math.log1p(link.value / 50); // 对功率进行对数缩放
        const baseCount = Math.max(5, Math.min(30, Math.ceil(powerFactor * 5))); // 基础粒子数
        // 根据距离调整，最少3个粒子
        const count = Math.max(3, Math.ceil(baseCount * (estimatedDistance / 150)));

        // 根据功率计算期望持续时间 (3 到 10 秒)
        // 功率越高 -> 持续时间越短 (速度越快)
        // 将功率范围 (例如 1W 到 10000W) 映射到持续时间范围 (10s 到 3s)
        const maxPower = 10000; // 假设用于缩放的最大功率
        const minDuration = 3 * 1000; // 3 秒 (毫秒)
        const maxDuration = 10 * 1000; // 10 秒 (毫秒)
        // 使用反比关系: duration = maxDur - (power/maxPower) * (maxDur - minDur)
        // 限制功率以避免极端值
        const clampedPower = Math.max(1, Math.min(link.value, maxPower));
        const duration = maxDuration - ((clampedPower / maxPower) * (maxDuration - minDuration));

        // 根据持续时间计算速度
        // progress 从 0 到 1。所以 speed 应该是 1 / duration (progress 单位/毫秒)
        const baseSpeed = 1 / duration; // 进度单位/毫秒

        for (let i = 0; i < count; i++) {
          this.particles.push({
            link,
            progress: Math.random(), // 在随机位置开始
            // 应用速度因子，速度单位是 progress/ms
            speed: baseSpeed * this.particleSpeedFactor
          });
        }
      }
    });
  }

  drawNode(node) {
    const { ctx } = this;
    ctx.save();

    // 绘制节点圆形背景
    ctx.beginPath();
    ctx.arc(node.x, node.y, this.nodeRadius, 0, Math.PI * 2);
    ctx.fillStyle = 'white';
    ctx.fill();
    ctx.strokeStyle = node.color;
    ctx.lineWidth = 2;
    ctx.stroke();

    // 绘制图标 - 增大图标尺寸比例
    const icon = this.loadedIcons.get(node.name);
    if (icon) {
      const iconSize = this.nodeRadius; // 图标尺寸比例从0.8到1.0
      ctx.drawImage(icon, node.x - iconSize / 2, node.y - iconSize / 2, iconSize, iconSize);
    }

    // 绘制节点标签 - 增大字体
    const fontSize = Math.max(12, Math.min(16, this.nodeRadius * 0.5)); // 增大字体尺寸
    ctx.font = `bold ${fontSize}px Arial`; // 添加粗体
    ctx.fillStyle = '#333';
    ctx.textAlign = 'center';
    ctx.fillText(node.name, node.x, node.y - this.nodeRadius - 10);

    // 绘制功率值 - 增大字体
    const powerValues = node.value.split('\n');
    powerValues.forEach((value, index) => {
      ctx.fillText(value, node.x, node.y + this.nodeRadius + 15 + (index * fontSize));
    });

    ctx.restore();
  }

  drawLink(link) {
    const { ctx } = this;
    const sourceNode = this.nodes.find(n => n.name === link.source);
    const targetNode = this.nodes.find(n => n.name === link.target);

    if (!sourceNode || !targetNode) return;

    // 获取节点中心点
    const sourceX = sourceNode.x;
    const sourceY = sourceNode.y;
    const targetX = targetNode.x;
    const targetY = targetNode.y;

    // 查找四个主要节点
    const nodes = this.nodes;
    const pvNode = nodes.find(n => n.name === '光伏');
    const batteryNode = nodes.find(n => n.name === '电池');
    const gridNode = nodes.find(n => n.name === '电网');
    const homeLoadNode = nodes.find(n => n.name === '家庭负载');

    // 特殊处理各种连接
    if (pvNode && batteryNode && gridNode && homeLoadNode) {
      // 计算中心点
      const centerX = (pvNode.x + batteryNode.x) / 2;
      const centerY = (gridNode.y + homeLoadNode.y) / 2;

      // 计算拐点公共参数 - 增大拐点距离
      const cornerDistance = Math.sqrt(this.nodeRadius) * 2; // 增大拐点距离

      // 设置线条样式
      ctx.save();
      ctx.strokeStyle = link.color;
      const lineWidth = Math.max(1.5, Math.min(3, this.nodeRadius / 10 * Math.min(4, link.value / 500)));
      ctx.lineWidth = lineWidth;
      ctx.beginPath();

      // 1. 光伏到家庭负载的连接
      if (link.source === '光伏' && link.target === '家庭负载') {
        // 计算从光伏节点右下方出发的点（约45度角）
        const startAngle = Math.PI / 4; // 右下方45度
        const startX = sourceX + Math.cos(startAngle) * this.nodeRadius;
        const startY = sourceY + Math.sin(startAngle) * this.nodeRadius;

        // 计算到家庭负载左上方的终点（约为45度角位置）
        const endAngle = Math.PI / 4; // 右上方45度
        const endX = targetX + Math.cos(endAngle) * this.nodeRadius;
        const endY = targetY + Math.sin(endAngle) * this.nodeRadius;

        // 基于参考中点计算拐点 - 调整拐点位置
        const cornerX = centerX + cornerDistance;
        const cornerY = centerY - cornerDistance * 1.5; // 使水平线离x轴更远

        // 圆角半径 - 增大圆弧半径
        const radius = Math.min(20, Math.min(
          Math.abs(cornerY - startY) * 0.3,
          Math.abs(endX - cornerX) * 0.3
        ));

        // 从光伏节点右下方开始
        ctx.moveTo(startX, startY);

        // 从起点垂直向下到拐角点前
        ctx.lineTo(startX, cornerY - radius);

        // 绘制第一个圆角
        ctx.arcTo(startX, cornerY, startX + radius, cornerY, radius);

        // 水平线到家庭负载节点下方
        const targetPointX = endX;
        ctx.lineTo(targetPointX, cornerY);

        // 垂直向上到终点
        ctx.lineTo(endX, endY);
      }
      // 2. 光伏到电网的连接
      else if (link.source === '光伏' && link.target === '电网') {
        // 从光伏节点左下角出发
        const startAngle = Math.PI * 3 / 4; // 左下方135度
        const startX = sourceX + Math.cos(startAngle) * this.nodeRadius;
        const startY = sourceY + Math.sin(startAngle) * this.nodeRadius;

        // 到电网节点右上角
        const endAngle = Math.PI / 4; // 右上方45度
        const endX = targetX + Math.cos(endAngle) * this.nodeRadius;
        const endY = targetY + Math.sin(endAngle) * this.nodeRadius;

        // 计算拐点 - 使用中点作为参考
        const cornerX = centerX - cornerDistance; // 向左移动
        const cornerY = centerY - cornerDistance * 1.5; // 使水平线离x轴更远

        // 圆角半径 - 增大圆弧半径
        const radius = Math.min(20, Math.min(
          Math.abs(cornerY - startY) * 0.3,
          Math.abs(endX - cornerX) * 0.3
        ));

        // 从光伏节点左下方开始
        ctx.moveTo(startX, startY);

        // 从起点垂直向上到拐角点前
        ctx.lineTo(startX, cornerY - radius);

        // 绘制第一个圆角
        ctx.arcTo(startX, cornerY, startX - radius, cornerY, radius);

        // 水平线到电网节点下方
        const targetPointX = endX;
        ctx.lineTo(targetPointX, cornerY);

        // 垂直向上到终点
        ctx.lineTo(endX, endY);
      }
      // 3. 电池到电网的连接
      else if (link.source === '电池' && link.target === '电网') {
        // 从电池节点左上角出发
        const startAngle = Math.PI * 3 / 4; // 左上方135度
        const startX = sourceX + Math.cos(startAngle) * this.nodeRadius;
        const startY = sourceY + Math.sin(startAngle) * this.nodeRadius;

        // 到电网节点右上角
        const endAngle = Math.PI / 4; // 右上方45度
        const endX = targetX + Math.cos(endAngle) * this.nodeRadius;
        const endY = targetY + Math.sin(endAngle) * this.nodeRadius;

        // 计算拐点 - 通过y轴对称于光伏-电网的拐点
        const symmetryAxisX = (gridNode.x + homeLoadNode.x) / 2;
        const pvGridCornerX = centerX - cornerDistance; // 光伏到电网的拐点
        const pvGridCornerY = centerY + cornerDistance * 1.5; // 使水平线离x轴更远

        const cornerX = 2 * symmetryAxisX - pvGridCornerX; // 沿y轴对称
        const cornerY = pvGridCornerY; // y坐标保持一致

        // 圆角半径 - 增大圆弧半径
        const radius = Math.min(20, Math.min(
          Math.abs(cornerY - startY) * 0.3,
          Math.abs(endX - cornerX) * 0.3
        ));

        // 从电池节点左上方开始
        ctx.moveTo(startX, startY);

        // 从起点垂直向上到拐角点前
        ctx.lineTo(startX, cornerY + radius);

        // 绘制第一个圆角
        ctx.arcTo(startX, cornerY, startX - radius, cornerY, radius);

        // 水平线到电网节点下方
        const targetPointX = endX;
        ctx.lineTo(targetPointX, cornerY);

        // 垂直向上到终点
        ctx.lineTo(endX, endY);
      }
      // 4. 电池到家庭负载的连接
      else if (link.source === '电池' && link.target === '家庭负载') {
        // 从电池节点右上角出发
        const startAngle = Math.PI / 4; // 右上方45度
        const startX = sourceX + Math.cos(startAngle) * this.nodeRadius;
        const startY = sourceY + Math.sin(startAngle) * this.nodeRadius;

        // 到家庭负载节点左上角
        const endAngle = Math.PI / 4; // 左上角45度
        const endX = targetX + Math.cos(endAngle) * this.nodeRadius;
        const endY = targetY + Math.sin(endAngle) * this.nodeRadius;

        // 计算拐点 - 通过y轴对称于光伏-家庭负载的拐点
        const symmetryAxisX = (gridNode.x + homeLoadNode.x) / 2;
        const pvHomeCornerX = centerX + cornerDistance;
        const pvHomeCornerY = centerY + cornerDistance * 1.5; // 使水平线离x轴更远

        const cornerX = 2 * symmetryAxisX - pvHomeCornerX; // 沿y轴对称
        const cornerY = pvHomeCornerY; // y坐标保持一致

        // 圆角半径 - 增大圆弧半径
        const radius = Math.min(20, Math.min(
          Math.abs(cornerY - startY) * 0.3,
          Math.abs(endX - cornerX) * 0.3
        ));

        // 从电池节点右上方开始
        ctx.moveTo(startX, startY);

        // 从起点垂直向上到拐角点前
        ctx.lineTo(startX, cornerY + radius);

        // 绘制第一个圆角
        ctx.arcTo(startX, cornerY, startX + radius, cornerY, radius);

        // 水平线到家庭负载节点下方
        const targetPointX = endX;
        ctx.lineTo(targetPointX, cornerY);

        // 垂直向上到终点
        ctx.lineTo(endX, endY);
      }
      // 其他连接使用默认方式
      else {
        // 计算离开源节点和进入目标节点的点
        const angle = Math.atan2(targetY - sourceY, targetX - sourceX);
        const startX = sourceX + Math.cos(angle) * this.nodeRadius;
        const startY = sourceY + Math.sin(angle) * this.nodeRadius;

        const endAngle = Math.atan2(sourceY - targetY, sourceX - targetX);
        const endX = targetX + Math.cos(endAngle) * this.nodeRadius;
        const endY = targetY + Math.sin(endAngle) * this.nodeRadius;

        ctx.moveTo(startX, startY);

        // 如果节点是水平或垂直排列的，使用直线
        if (Math.abs(sourceX - targetX) < 10 || Math.abs(sourceY - targetY) < 10) {
          ctx.lineTo(endX, endY);
        } else {
          // 使用二次贝塞尔曲线实现圆角效果
          const midX = (sourceX + targetX) / 2;
          const midY = (sourceY + targetY) / 2;
          ctx.quadraticCurveTo(midX, midY, endX, endY);
        }
      }
      ctx.stroke();
      ctx.restore();
    } else {
      // 处理找不到节点的情况，使用默认连接方式
      // 计算离开源节点和进入目标节点的点
      const angle = Math.atan2(targetY - sourceY, targetX - sourceX);
      const startX = sourceX + Math.cos(angle) * this.nodeRadius;
      const startY = sourceY + Math.sin(angle) * this.nodeRadius;

      const endAngle = Math.atan2(sourceY - targetY, sourceX - targetX);
      const endX = targetX + Math.cos(endAngle) * this.nodeRadius;
      const endY = targetY + Math.sin(endAngle) * this.nodeRadius;

      // 设置线条样式
      ctx.save();
      ctx.strokeStyle = link.color;
      const lineWidth = Math.max(1.5, Math.min(3, this.nodeRadius / 10 * Math.min(4, link.value / 500)));
      ctx.lineWidth = lineWidth;

      ctx.beginPath();
      ctx.moveTo(startX, startY);

      // 其他连接继续使用简单的二次贝塞尔曲线
      const midX = (sourceX + targetX) / 2;
      const midY = (sourceY + targetY) / 2;

      // 如果节点是水平或垂直排列的，使用直线
      if (Math.abs(sourceX - targetX) < 10 || Math.abs(sourceY - targetY) < 10) {
        ctx.lineTo(endX, endY);
      } else {
        // 使用二次贝塞尔曲线实现圆角效果
        ctx.quadraticCurveTo(midX, midY, endX, endY);
      }
      ctx.stroke();
      ctx.restore();
    }
  }

  drawParticle(particle) {
    const { ctx } = this;
    const sourceNode = this.nodes.find(n => n.name === particle.link.source);
    const targetNode = this.nodes.find(n => n.name === particle.link.target);

    // 如果连接不可见或节点不存在，则不绘制粒子
    if (!sourceNode || !targetNode || !particle.link.visible) return;

    const sourceX = sourceNode.x;
    const sourceY = sourceNode.y;
    const targetX = targetNode.x;
    const targetY = targetNode.y;
    const t = particle.progress; // 粒子沿路径的进度 (0 到 1)
    const nodeRadius = this.nodeRadius; // 使用当前节点半径

    // 查找四个主要节点以进行路径计算逻辑
    const nodes = this.nodes;
    const pvNode = nodes.find(n => n.name === '光伏');
    const batteryNode = nodes.find(n => n.name === '电池');
    const gridNode = nodes.find(n => n.name === '电网');
    const homeLoadNode = nodes.find(n => n.name === '家庭负载');

    let x, y; // 粒子位置

    // --- 路径计算逻辑 ---
    // 需要精确镜像 drawLink 的逻辑。
    // 对于复杂的带 arcTo 的路径，下面的实现使用了简化的二次贝塞尔曲线作为近似。
    // 如果需要精确路径，需要仔细分析 drawLink 中的 arcTo 并实现分段插值。

    // 计算起点和终点（考虑节点半径）
    const angle = Math.atan2(targetY - sourceY, targetX - sourceX);
    const startX = sourceX + Math.cos(angle) * nodeRadius;
    const startY = sourceY + Math.sin(angle) * nodeRadius;
    const endAngle = Math.atan2(sourceY - targetY, sourceX - targetX); // 进入目标节点的角度的反向
    const endX = targetX + Math.cos(endAngle) * nodeRadius;
    const endY = targetY + Math.sin(endAngle) * nodeRadius;

    // 检查是否有自定义控制点配置
    const linkKey = `${particle.link.source}-${particle.link.target}`;
    const customConfig = this.customControlPoints[linkKey];

    if (customConfig && customConfig.offset) {
      // 使用自定义控制点配置
      const midX = (startX + endX) / 2 + (startY - endY) * customConfig.offset.x;
      const midY = (startY + endY) / 2 + (endX - startX) * customConfig.offset.y;
      const pos = this.getPointOnQuadraticBezier(startX, startY, midX, midY, endX, endY, t);
      x = pos.x;
      y = pos.y;
    }
    else if (pvNode && batteryNode && gridNode && homeLoadNode &&
        (
         (particle.link.source === '光伏' && (particle.link.target === '家庭负载' || particle.link.target === '电网')) ||
         (particle.link.source === '电池' && (particle.link.target === '家庭负载' || particle.link.target === '电网')) ||
         (particle.link.target === '光伏' && (particle.link.source === '家庭负载' || particle.link.source === '电网')) || // 反向流动?
         (particle.link.target === '电池' && (particle.link.source === '家庭负载' || particle.link.source === '电网'))   // 反向流动?
        )
       )
    {
        // --- 对特定复杂路径使用近似 ---
        // console.log(`Approximating path for ${particle.link.source} -> ${particle.link.target}`);

        // 使用简化的二次贝塞尔曲线近似这些复杂路径
        // 控制点可以根据需要调整以获得更好的曲线形状
        let midX, midY;
        if (particle.link.source === '光伏' && particle.link.target === '家庭负载') {
            midX = (startX + endX) / 2 + (startY - endY) * 0.3; // 控制点偏离直线
            midY = (startY + endY) / 2 + (endX - startX) * 0.1;
        } else if (particle.link.source === '光伏' && particle.link.target === '电网') {
            midX = (startX + endX) / 2 + (startY - endY) * -0.3;
            midY = (startY + endY) / 2 + (endX - startX) * -0.1;
        } else if (particle.link.source === '电池' && particle.link.target === '电网') {
            midX = (startX + endX) / 2 + (startY - endY) * -0.3;
            midY = (startY + endY) / 2 + (endX - startX) * 0.1;
        } else if (particle.link.source === '电池' && particle.link.target === '家庭负载') {
            midX = (startX + endX) / 2 + (startY - endY) * 0.3;
            midY = (startY + endY) / 2 + (endX - startX) * -0.1;
        } else {
             // 如果有其他复杂路径或反向路径，使用默认中点
             midX = (startX + endX) / 2;
             midY = (startY + endY) / 2;
        }

        const pos = this.getPointOnQuadraticBezier(startX, startY, midX, midY, endX, endY, t);
        x = pos.x;
        y = pos.y;

    } else {
        // --- 默认情况: 直线或简单的二次贝塞尔曲线 ---
        if (Math.abs(sourceX - targetX) < 10 || Math.abs(sourceY - targetY) < 10) {
            // 直线插值
            const pos = this.getPointOnLine(startX, startY, endX, endY, t);
            x = pos.x; y = pos.y;
        } else {
            // 二次贝塞尔插值 (使用中点作为控制点)
            const midX = (startX + endX) / 2;
            const midY = (startY + endY) / 2;
            const pos = this.getPointOnQuadraticBezier(startX, startY, midX, midY, endX, endY, t);
            x = pos.x; y = pos.y;
        }
    }


    // 绘制粒子（如果位置有效）
    if (x !== undefined && y !== undefined) {
        ctx.save();
        ctx.beginPath();
        // 根据功率动态调整粒子大小，使其更小一些
        const baseParticleSize = 1.5; // 基础尺寸
        const powerFactorSize = Math.min(1.5, Math.log1p(particle.link.value / 150)); // 功率越大尺寸略微增大
        const particleSize = baseParticleSize + powerFactorSize;
        ctx.arc(x, y, particleSize, 0, Math.PI * 2);
        ctx.fillStyle = particle.link.color;
        ctx.globalAlpha = 0.8; // 设置透明度
        ctx.fill();
        ctx.restore();
    } else {
        console.warn("粒子位置计算失败，连接:", particle.link.source, "->", particle.link.target);
    }
  }

  updateParticles(deltaTime) { // 从 draw 循环传递 deltaTime
    if (isNaN(deltaTime) || deltaTime <= 0) return; // 避免在第一帧或暂停时出现问题

    this.particles.forEach(particle => {
      particle.progress += particle.speed * deltaTime; // 根据时间增量更新进度
      // 当粒子完成路径后重置
      if (particle.progress >= 1) {
        particle.progress = 0; // 重置到起点
        // 可选: 添加小的随机偏移以避免聚集
        // particle.progress = Math.random() * 0.05;
      }
    });
  }

  draw() {
    const { ctx, canvas } = this;
    const now = Date.now();
    const deltaTime = now - this.lastUpdateTime; // 计算时间差 (毫秒)
    this.lastUpdateTime = now;

    // 确保Canvas的尺寸正确
    if (canvas.width / canvas.height !== 1.5) {
      // 如果比例不是3:2，重新调整
      canvas.height = Math.floor(canvas.width * 2 / 3);
    }

    // 清除画布
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 在绘制之前更新粒子位置
    this.updateParticles(deltaTime); // 传递 deltaTime

    // 绘制连线 (移除 if(link.visible) 判断)
    this.links.forEach(link => {
       // 不再需要 if (link.visible)
       this.drawLink(link); // 直接绘制所有连线
    });

    // 绘制粒子 (drawParticle 内部会检查 link.visible)
    this.particles.forEach(particle => this.drawParticle(particle));

    // 绘制节点
    this.nodes.forEach(node => this.drawNode(node));

    // 继续动画
    // 清除之前的动画帧请求
    if (this.animationFrameId) {
        cancelAnimationFrame(this.animationFrameId);
    }
    this.animationFrameId = requestAnimationFrame(() => this.draw());
  }

  // 登录并获取数据
  async loginAndFetchData() {
    try {
      // 登录
      await login('2751043328@qq.com', '85acc0766d3aa341c0e45fafce735e79');
      // 登录成功后获取数据
      await this.fetchData();
    } catch (error) {
      console.error('登录失败:', error);
    } finally {
      // 数据获取后启动绘制循环
      this.lastUpdateTime = Date.now(); // 重置时间戳
      this.draw();
    }
  }

  // 获取数据
  async fetchData() {
    try {
      // 获取能源流向数据
      const flowData = await getEnergyFlowData();
      if (flowData) {
        console.log('获取到能流图数据:', flowData);
        // 解析各项功率数据
        let {
          gridPower, // 电网功率
          solarPower, // 光伏功率
          loadPower, // 负载功率
          homePower, // 智能负载功率
          batPower, // 电池功率
          chargerList, // 充电桩列表
          solarWorkMode // 光伏工作模式
        } = flowData;

        // 计算充电桩总功率
        const chargerPower = chargerList?.reduce((sum, charger) => sum + (charger.power || 0), 0) || 0;

        // 计算家庭总负载
        //去掉单位W
        loadPower = Number(loadPower.replace('W', ''));
        batPower = Number(batPower.replace('W', ''));
        solarPower = Number(solarPower.replace('W', ''));
        homePower = Number(homePower.replace('W', ''));
        gridPower = Number(gridPower.replace('W', ''));
        const totalLoadPower = loadPower + homePower + chargerPower;

        // 更新流向数据，确保每个节点在同一时间只能有一个流向
        const flows = {
          pv_to_grid: 0,
          pv_to_battery: 0,
          pv_to_load: 0,
          battery_to_grid: 0,
          battery_to_load: 0,
          grid_to_battery: 0,
          grid_to_load: 0
        };

        // 获取电池和电网的工作模式
        const { batWorkMode, gridWorkMode } = flowData;

        if (
          typeof batWorkMode === 'number' &&
          typeof gridWorkMode === 'number' &&
          typeof solarWorkMode === 'number'
        ) {
          // 1. 光伏发电模式
          if (solarWorkMode !== 0) {
            // 光伏优先供负载
            flows.pv_to_load = Math.min(solarPower, totalLoadPower);

            // 光伏多余部分
            const solarRemain = solarPower - flows.pv_to_load;

            // 光伏多余部分优先充电池（电池允许充电时）
            if (batWorkMode === 1 && solarRemain > 0 && batPower > 0) {
              flows.pv_to_battery = Math.min(solarRemain, batPower);
            }

            // 光伏剩余再送电网（电网允许卖电时）
            const solarRemain2 = solarRemain - flows.pv_to_battery;
            if (solarRemain2 > 0 && gridWorkMode === -1) {
              flows.pv_to_grid = solarRemain2;
            }
          }

          // 2. 电池放电模式
          if (batWorkMode === -1) {
            // 电池优先供负载
            flows.battery_to_load = Math.min(batPower, totalLoadPower - flows.pv_to_load);

            // 电池多余部分送电网（电网允许卖电时）
            const batteryRemain = batPower - flows.battery_to_load;
            if (batteryRemain > 0 && gridWorkMode === -1) {
              flows.battery_to_grid = Math.min(batteryRemain, Math.abs(gridPower));
            }
          }

          // 3. 电网供电模式
          if (gridWorkMode === 1) {
            // 电网补充负载
            const remainLoad = totalLoadPower - flows.pv_to_load - flows.battery_to_load;
            if (remainLoad > 0) {
              flows.grid_to_load = remainLoad;
            }
            // 电网给电池充电（电池允许充电时）
            if (batWorkMode === 1 && batPower > flows.pv_to_battery) {
              flows.grid_to_battery = batPower - flows.pv_to_battery;
            }
          }
        } else {
          // workmode缺失时，按power兜底
          if (batPower > 0) {
            flows.battery_to_load = Math.min(batPower, totalLoadPower);
          }
          if (solarPower > 0) {
            flows.pv_to_load = Math.min(solarPower, totalLoadPower);
          }
        }

        // 更新节点显示的功率值
        this.nodes.forEach(node => {
          switch (node.name) {
            case '电网':
              node.value = `${gridPower} W`;
              break;
            case '光伏':
              node.value = `${solarPower} W`;
              break;
            case '电池':
              node.value = `${batPower} W`;
              break;
            case '家庭负载':
              node.value = `${totalLoadPower} W`;
              break;
            case '充电桩':
              node.value = `${chargerPower} W`;
              break;
            case '智能负载':
              node.value = `${loadPower} W`;
              break;
          }
        });

        // 更新连接的流向值
        this.updateLinks(flows);
        // 重新初始化粒子系统
        this.initParticles();
      }

      // 获取电池状态
      const batteryStatus = await getStatusNow();
      if (batteryStatus) {
        console.log('获取到曲线图数据:', batteryStatus);
        // this.updateBatteryStatus(batteryStatus);
      }
    } catch (error) {
      console.error('获取数据失败:', error);
    }
  }

  // 更新流向数据
  updateFlowData(data) {
    // 适配不同格式的返回数据
    const adaptedData = this.adaptFlowData(data);

    // 存储适配后的数据
    this.flowData = adaptedData;

    // 根据适配后的数据更新连接
    this.updateLinks(adaptedData);

    // 重新初始化粒子系统
    this.initParticles();
  }

  // 适配不同格式的流向数据
  adaptFlowData(data) {
    // 默认数据结构
    const defaultData = {
      pv_to_grid: 0,
      pv_to_battery: 0,
      pv_to_load: 0,
      battery_to_grid: 0,
      battery_to_load: 0,
      grid_to_battery: 0,
      grid_to_load: 0
    };

    // 如果数据为空或不是对象，返回默认值
    if (!data || typeof data !== 'object') {
      console.warn('流向数据格式不正确，使用默认值');
      return defaultData;
    }

    // 尝试适配不同格式的数据
    const adapted = { ...defaultData };

    // 遍历所有可能的键名映射
    const keyMappings = {
      // 标准键名
      pv_to_grid: ['pv_to_grid', 'pvToGrid', 'pv2grid', 'solar_to_grid'],
      pv_to_battery: ['pv_to_battery', 'pvToBattery', 'pv2batt', 'solar_to_battery'],
      pv_to_load: ['pv_to_load', 'pvToLoad', 'pv2load', 'solar_to_load'],
      battery_to_grid: ['battery_to_grid', 'batteryToGrid', 'batt2grid'],
      battery_to_load: ['battery_to_load', 'batteryToLoad', 'batt2load'],
      grid_to_battery: ['grid_to_battery', 'gridToBattery', 'grid2batt'],
      grid_to_load: ['grid_to_load', 'gridToLoad', 'grid2load']
    };

    // 对每个标准键，尝试从数据中找到匹配的键
    Object.entries(keyMappings).forEach(([standardKey, possibleKeys]) => {
      for (const key of possibleKeys) {
        if (key in data && data[key] !== undefined) {
          // 找到匹配的键，将值转换为数字并存储
          adapted[standardKey] = Number(data[key]);
          break;
        }
      }
    });

    // 处理可能的嵌套结构
    if (data.flows && typeof data.flows === 'object') {
      return this.adaptFlowData(data.flows);
    }

    // 处理可能的数组结构
    if (Array.isArray(data)) {
      data.forEach(item => {
        if (item.source && item.target && item.value !== undefined) {
          // 从数组元素中提取流向数据
          const source = String(item.source).toLowerCase();
          const target = String(item.target).toLowerCase();
          const value = Number(item.value);

          if (source.includes('pv') || source.includes('solar')) {
            if (target.includes('grid')) adapted.pv_to_grid = value;
            else if (target.includes('batt')) adapted.pv_to_battery = value;
            else if (target.includes('load')) adapted.pv_to_load = value;
          } else if (source.includes('batt')) {
            if (target.includes('grid')) adapted.battery_to_grid = value;
            else if (target.includes('load')) adapted.battery_to_load = value;
          } else if (source.includes('grid')) {
            if (target.includes('batt')) adapted.grid_to_battery = value;
            else if (target.includes('load')) adapted.grid_to_load = value;
          }
        }
      });
    }

    console.log('适配后的流向数据:', adapted);
    return adapted;
  }

  // 更新连接数据
  updateLinks(flowData) {
    if (!this.links || !Array.isArray(this.links)) return;

    this.links.forEach(link => {
      let linkValue = 0;
      // 根据连接的源和目标节点设置value值
      if (link.source === '光伏' && link.target === '电网') {
        linkValue = flowData.pv_to_grid;
      } else if (link.source === '光伏' && link.target === '电池') {
        linkValue = flowData.pv_to_battery;
      } else if (link.source === '光伏' && link.target === '家庭负载') {
        linkValue = flowData.pv_to_load;
      } else if (link.source === '电池' && link.target === '电网') {
        linkValue = flowData.battery_to_grid;
      } else if (link.source === '电池' && link.target === '家庭负载') {
        linkValue = flowData.battery_to_load;
      } else if (link.source === '电网' && link.target === '电池') {
        linkValue = flowData.grid_to_battery;
      } else if (link.source === '电网' && link.target === '家庭负载') {
        linkValue = flowData.grid_to_load;
      }
      // 可以添加更多连接的处理，例如到充电桩和智能负载
      // else if (link.source === '家庭负载' && link.target === '充电桩') { ... }
      // else if (link.source === '家庭负载' && link.target === '智能负载') { ... }

      link.value = Math.abs(linkValue); // 使用绝对值，方向由流向决定

      // 根据流向值调整粒子可见性
      link.visible = link.value > 0;
    });
  }

  // 更新电池状态
  updateBatteryStatus(data) {
    // 适配不同格式的返回数据
    const batteryData = this.adaptBatteryData(data);

    // 更新电池节点的信息
    const batteryNode = this.nodes.find(n => n.name === '电池');
    if (batteryNode) {
      batteryNode.value = `${batteryData.status}\n${batteryData.percentage}%\n${batteryData.power}W`;
      batteryNode.rawData = batteryData;
    }
  }

  destroy() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    if (this.dataRefreshInterval) {
      clearInterval(this.dataRefreshInterval);
    }
    // 停止会话续期
    stopSessionRenewal();
    window.removeEventListener('resize', this.resize);
    this.container.removeChild(this.canvas);
  }

  // --- 辅助函数 ---
  // 获取直线段上的点
  getPointOnLine(x1, y1, x2, y2, t) {
    return {
        x: x1 + (x2 - x1) * t,
        y: y1 + (y2 - y1) * t
    };
  }

  // 获取二次贝塞尔曲线上的点
  getPointOnQuadraticBezier(x0, y0, x1, y1, x2, y2, t) {
    const oneMinusT = 1 - t;
    return {
        x: oneMinusT * oneMinusT * x0 + 2 * oneMinusT * t * x1 + t * t * x2,
        y: oneMinusT * oneMinusT * y0 + 2 * oneMinusT * t * y1 + t * t * y2
    };
  }

  // 计算两点间距离
  distance(x1, y1, x2, y2) {
    return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
  }
  // --- 结束辅助函数 ---

  /**
   * 设置自定义控制点，用于优化曲线路径
   * @param {Object} controlPoints - 控制点配置对象，键为"source-target"格式
   */
  setCustomControlPoints(controlPoints) {
    this.customControlPoints = controlPoints || {};
    // 重绘图表以应用新的控制点
    this.draw();
  }
}

export default EnergyFlowCanvas;