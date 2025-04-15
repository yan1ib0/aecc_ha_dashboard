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
    
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const rect = this.container.getBoundingClientRect();
    // 设置宽度为容器宽度
    const width = rect.width;
    // 计算高度为宽度的2/3，实现3:2的宽高比
    const height = Math.floor(width * 2/3);
    
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
    this.particleSpeedFactor = speedFactor;
    this.initParticles();
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
      // 计算源节点和目标节点之间的距离
      const sourceNode = this.nodes.find(n => n.name === link.source);
      const targetNode = this.nodes.find(n => n.name === link.target);
      
      if (sourceNode && targetNode) {
        const dx = targetNode.x - sourceNode.x;
        const dy = targetNode.y - sourceNode.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // 根据距离、功率值和节点大小调整粒子数量
        const distanceFactor = distance / 200; // 标准化距离因子
        const baseCount = Math.floor(link.value / 400); // 降低阈值，增加基础粒子数
        const count = Math.max(2, Math.ceil(baseCount * distanceFactor)); // 确保至少有2个粒子
        
      for (let i = 0; i < count; i++) {
        this.particles.push({
          link,
          progress: Math.random(),
            speed: (0.001 + Math.random() * 0.001) * this.particleSpeedFactor
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
      const iconSize = this.nodeRadius * 1.0; // 增大图标尺寸比例从0.8到1.0
      ctx.drawImage(icon, node.x - iconSize/2, node.y - iconSize/2, iconSize, iconSize);
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
      
      // 计算拐点公共参数
      const cornerDistance = Math.sqrt(this.nodeRadius);
      
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
        
        // 基于参考中点计算拐点
        const cornerX = centerX + cornerDistance;
        const cornerY = centerY - cornerDistance;
        
        // 圆角半径
        const radius = Math.min(12, Math.min(
          Math.abs(cornerY - startY) * 0.2, 
          Math.abs(endX - cornerX) * 0.2
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
        const startAngle = Math.PI * 3/4; // 左下方135度
        const startX = sourceX + Math.cos(startAngle) * this.nodeRadius;
        const startY = sourceY + Math.sin(startAngle) * this.nodeRadius;
        
        // 到电网节点右上角
        const endAngle = Math.PI / 4; // 右上方45度
        const endX = targetX + Math.cos(endAngle) * this.nodeRadius;
        const endY = targetY + Math.sin(endAngle) * this.nodeRadius;
        
        // 计算拐点 - 使用中点作为参考
        const cornerX = centerX - cornerDistance; // 向左移动
        const cornerY = centerY - cornerDistance; // 向上移动
        
        // 圆角半径
        const radius = Math.min(12, Math.min(
          Math.abs(cornerY - startY) * 0.2, 
          Math.abs(endX - cornerX) * 0.2
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
      // 3. 电池到电网的连接 - 参考光伏到电网连接，沿y轴对称
      else if (link.source === '电池' && link.target === '电网') {
        // 从电池节点左下角出发 - 对应光伏节点的左下角
        const startAngle = Math.PI * 3/4; // 左下方135度
        const startX = sourceX + Math.cos(startAngle) * this.nodeRadius;
        const startY = sourceY + Math.sin(startAngle) * this.nodeRadius;
        
        // 到电网节点右上角 - 与光伏到电网相同
        const endAngle = Math.PI / 4; // 右上方45度
        const endX = targetX + Math.cos(endAngle) * this.nodeRadius;
        const endY = targetY + Math.sin(endAngle) * this.nodeRadius;
        
        // 计算拐点 - 通过y轴对称于光伏-电网的拐点
        // 以电网-家庭负载的y轴为对称轴
        const symmetryAxisX = (gridNode.x + homeLoadNode.x) / 2;
        const pvGridCornerX = centerX - cornerDistance; // 光伏到电网的拐点
        const pvGridCornerY = centerY + cornerDistance;
        
        const cornerX = 2 * symmetryAxisX - pvGridCornerX; // 沿y轴对称
        const cornerY = pvGridCornerY; // y坐标保持一致
        
        // 圆角半径
        const radius = Math.min(12, Math.min(
          Math.abs(cornerY - startY) * 0.2, 
          Math.abs(endX - cornerX) * 0.2
        ));
        
        // 从电池节点左下方开始
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
      // 4. 电池到家庭负载的连接 - 参考光伏到家庭负载连接，沿y轴对称
      else if (link.source === '电池' && link.target === '家庭负载') {
        // 从电池节点右下角出发 - 对应光伏节点的右下角
        const startAngle = Math.PI / 4; // 右下方45度
        const startX = sourceX + Math.cos(startAngle) * this.nodeRadius;
        const startY = sourceY + Math.sin(startAngle) * this.nodeRadius;
        
        // 到家庭负载节点左上角 - 与光伏到家庭负载相同
        const endAngle = Math.PI / 4; // 左上角45度（实际是右上角，但对家庭负载而言是左上）
        const endX = targetX + Math.cos(endAngle) * this.nodeRadius;
        const endY = targetY + Math.sin(endAngle) * this.nodeRadius;
        
        // 计算拐点 - 通过y轴对称于光伏-家庭负载的拐点
        // 以电网-家庭负载的y轴为对称轴
        const symmetryAxisX = (gridNode.x + homeLoadNode.x) / 2;
        const pvHomeCornerX = centerX + cornerDistance;
        const pvHomeCornerY = centerY + cornerDistance;
        
        const cornerX = 2 * symmetryAxisX - pvHomeCornerX; // 沿y轴对称
        const cornerY = pvHomeCornerY; // y坐标保持一致
        
        // 圆角半径
        const radius = Math.min(12, Math.min(
          Math.abs(cornerY - startY) * 0.2,
          Math.abs(endX - cornerX) * 0.2
        ));
        
        // 从电池节点右下角开始
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
    
    if (!sourceNode || !targetNode) return;

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
    
    // 粒子沿路径的进度
    const t = particle.progress;
    let x, y;
    
    // 特殊处理各种连接的粒子
    if (pvNode && batteryNode && gridNode && homeLoadNode) {
      // 计算中心点 - 与绘制线条部分保持一致
      const centerX = (pvNode.x + batteryNode.x) / 2;
      const centerY = (gridNode.y + homeLoadNode.y) / 2;
      
      // 计算拐点公共参数
      const cornerDistance = Math.sqrt(this.nodeRadius);
      
      // 计算对称轴 - 用于y轴对称
      const symmetryAxisX = (gridNode.x + homeLoadNode.x) / 2;
    
      // 1. 光伏到家庭负载的粒子
      if (particle.link.source === '光伏' && particle.link.target === '家庭负载') {
        // 计算从光伏节点右下方出发的点（约45度角）
        const startAngle = Math.PI / 4; // 右下方45度
        const startX = sourceX + Math.cos(startAngle) * this.nodeRadius;
        const startY = sourceY + Math.sin(startAngle) * this.nodeRadius;
        
        // 计算到家庭负载右上方的终点（约为45度角位置）
        const endAngle = Math.PI / 4; // 右上方45度
        const endX = targetX + Math.cos(endAngle) * this.nodeRadius;
        const endY = targetY + Math.sin(endAngle) * this.nodeRadius;
        
        // 基于中点计算拐点
        const cornerX = centerX + cornerDistance;
        const cornerY = centerY - cornerDistance;
        
        // 计算水平线终点
        const targetPointX = endX;
        const targetPointY = cornerY;
        
        // 计算路径总长度与各段长度
        const verticalLength = Math.abs(cornerY - startY);
        const horizontalLength = Math.abs(targetPointX - startX);
        const verticalEndLength = Math.abs(endY - targetPointY);
        const totalLength = verticalLength + horizontalLength + verticalEndLength;
        
        // 基于总路径长度确定粒子位置
        let distanceAlongPath = totalLength * t;
        
        // 第一段：垂直向下移动
        if (distanceAlongPath <= verticalLength) {
          x = startX;
          y = startY + distanceAlongPath * Math.sign(cornerY - startY);
        } 
        // 第二段：水平向右移动
        else if (distanceAlongPath <= verticalLength + horizontalLength) {
          x = startX + (distanceAlongPath - verticalLength) * Math.sign(targetPointX - startX);
          y = cornerY;
        } 
        // 第三段：垂直向上到终点
        else {
          x = targetPointX;
          y = targetPointY + (distanceAlongPath - verticalLength - horizontalLength) * Math.sign(endY - targetPointY);
        }
      }
      
      // 2. 光伏到电网的粒子
      else if (particle.link.source === '光伏' && particle.link.target === '电网') {
        // 从光伏节点左下角出发
        const startAngle = Math.PI * 3/4; // 左下方135度
        const startX = sourceX + Math.cos(startAngle) * this.nodeRadius;
        const startY = sourceY + Math.sin(startAngle) * this.nodeRadius;
        
        // 到电网节点右上角
        const endAngle = Math.PI / 4; // 右上方45度
        const endX = targetX + Math.cos(endAngle) * this.nodeRadius;
        const endY = targetY + Math.sin(endAngle) * this.nodeRadius;
        
        // 计算拐点 - 使用中点作为参考
        const cornerX = centerX - cornerDistance; // 向左移动
        const cornerY = centerY - cornerDistance; // 向上移动
        
        // 计算水平线终点
        const targetPointX = endX;
        const targetPointY = cornerY;
        
        // 计算路径总长度与各段长度
        const verticalLength = Math.abs(cornerY - startY);
        const horizontalLength = Math.abs(targetPointX - cornerX);
        const verticalEndLength = Math.abs(endY - targetPointY);
        const totalLength = verticalLength + horizontalLength + verticalEndLength;
        
        // 基于总路径长度确定粒子位置
        let distanceAlongPath = totalLength * t;
        
        // 第一段：垂直向上移动
        if (distanceAlongPath <= verticalLength) {
          x = startX;
          y = startY + distanceAlongPath * Math.sign(cornerY - startY);
        } 
        // 第二段：水平向右移动
        else if (distanceAlongPath <= verticalLength + horizontalLength) {
          x = cornerX + (distanceAlongPath - verticalLength) * Math.sign(targetPointX - cornerX);
          y = cornerY;
        } 
        // 第三段：垂直向下到终点
        else {
          x = targetPointX;
          y = targetPointY + (distanceAlongPath - verticalLength - horizontalLength) * Math.sign(endY - targetPointY);
        }
      }
      
      // 3. 电池到电网的粒子 - 参考光伏到电网粒子
      else if (particle.link.source === '电池' && particle.link.target === '电网') {
        // 从电池节点左下角出发
        const startAngle = Math.PI * 3/4; // 左下方135度
        const startX = sourceX + Math.cos(startAngle) * this.nodeRadius;
        const startY = sourceY + Math.sin(startAngle) * this.nodeRadius;
        
        // 到电网节点右上角
        const endAngle = Math.PI / 4; // 右上方45度
        const endX = targetX + Math.cos(endAngle) * this.nodeRadius;
        const endY = targetY + Math.sin(endAngle) * this.nodeRadius;
        
        // 计算拐点 - 通过y轴对称于光伏-电网的拐点
        // 以电网-家庭负载的y轴为对称轴
        const symmetryAxisX = (gridNode.x + homeLoadNode.x) / 2;
        const pvGridCornerX = centerX - cornerDistance; // 光伏到电网的拐点
        const pvGridCornerY = centerY - cornerDistance;
        
        const cornerX = 2 * symmetryAxisX - pvGridCornerX; // 沿y轴对称
        const cornerY = pvGridCornerY; // y坐标保持一致
        
        // 计算水平线终点
        const targetPointX = endX;
        const targetPointY = cornerY;
        
        // 计算路径总长度与各段长度
        const verticalLength = Math.abs(cornerY - startY);
        const horizontalLength = Math.abs(targetPointX - cornerX);
        const verticalEndLength = Math.abs(endY - targetPointY);
        const totalLength = verticalLength + horizontalLength + verticalEndLength;
        
        // 基于总路径长度确定粒子位置
        let distanceAlongPath = totalLength * t;
        
        // 第一段：垂直向上移动
        if (distanceAlongPath <= verticalLength) {
          x = startX;
          y = startY + distanceAlongPath * Math.sign(cornerY - startY);
        } 
        // 第二段：水平向右移动
        else if (distanceAlongPath <= verticalLength + horizontalLength) {
          x = cornerX + (distanceAlongPath - verticalLength) * Math.sign(targetPointX - cornerX);
          y = cornerY;
        } 
        // 第三段：垂直向上到终点
        else {
          x = targetPointX;
          y = targetPointY + (distanceAlongPath - verticalLength - horizontalLength) * Math.sign(endY - targetPointY);
        }
      }
      // 4. 电池到家庭负载的粒子 - 参考光伏到家庭负载粒子，沿y轴对称
      else if (particle.link.source === '电池' && particle.link.target === '家庭负载') {
        // 从电池节点右下角出发
        const startAngle = Math.PI / 4; // 右下方45度
        const startX = sourceX + Math.cos(startAngle) * this.nodeRadius;
        const startY = sourceY + Math.sin(startAngle) * this.nodeRadius;
        
        // 到家庭负载节点左上角
        const endAngle = Math.PI / 4; // 左上角45度
        const endX = targetX + Math.cos(endAngle) * this.nodeRadius;
        const endY = targetY + Math.sin(endAngle) * this.nodeRadius;
        
        // 计算光伏到家庭负载的拐点 - 注意与drawLink保持一致
        const pvHomeCornerX = centerX + cornerDistance;
        const pvHomeCornerY = centerY - cornerDistance;
        
        // 计算拐点 - 沿y轴对称
        const cornerX = 2 * symmetryAxisX - pvHomeCornerX;
        const cornerY = pvHomeCornerY;
        
        // 计算水平线终点
        const targetPointX = endX;
        const targetPointY = cornerY;
        
        // 计算路径总长度与各段长度
        const verticalLength = Math.abs(cornerY - startY);
        const horizontalLength = Math.abs(targetPointX - cornerX);
        const verticalEndLength = Math.abs(endY - targetPointY);
        const totalLength = verticalLength + horizontalLength + verticalEndLength;
        
        // 基于总路径长度确定粒子位置
        let distanceAlongPath = totalLength * t;
        
        // 第一段：垂直向上移动
        if (distanceAlongPath <= verticalLength) {
          x = startX;
          y = startY + distanceAlongPath * Math.sign(cornerY - startY);
        } 
        // 第二段：水平向左移动
        else if (distanceAlongPath <= verticalLength + horizontalLength) {
          x = cornerX + (distanceAlongPath - verticalLength) * Math.sign(targetPointX - cornerX);
          y = cornerY;
        } 
        // 第三段：垂直向上到终点
        else {
          x = targetPointX;
          y = targetPointY + (distanceAlongPath - verticalLength - horizontalLength) * Math.sign(endY - targetPointY);
        }
      }
      // 其他连接的粒子使用默认方式
      else {
        // 确定起点和终点
        const angle = Math.atan2(targetY - sourceY, targetX - sourceX);
        const startX = sourceX + Math.cos(angle) * this.nodeRadius;
        const startY = sourceY + Math.sin(angle) * this.nodeRadius;
        
        const endAngle = Math.atan2(sourceY - targetY, sourceX - targetX);
        const endX = targetX + Math.cos(endAngle) * this.nodeRadius;
        const endY = targetY + Math.sin(endAngle) * this.nodeRadius;
        
        // 其他连接继续使用原来的贝塞尔曲线计算
        const midX = (sourceX + targetX) / 2;
        const midY = (sourceY + targetY) / 2;
        
        if (Math.abs(sourceX - targetX) < 10 || Math.abs(sourceY - targetY) < 10) {
          // 在直线上线性插值
          x = startX + (endX - startX) * t;
          y = startY + (endY - startY) * t;
        } else {
          // 在二次贝塞尔曲线上计算点
          const oneMinusT = 1 - t;
          x = oneMinusT * oneMinusT * startX + 2 * oneMinusT * t * midX + t * t * endX;
          y = oneMinusT * oneMinusT * startY + 2 * oneMinusT * t * midY + t * t * endY;
        }
      }
    } else {
      // 处理找不到节点的情况，使用默认粒子计算
      // 确定起点和终点
      const angle = Math.atan2(targetY - sourceY, targetX - sourceX);
      const startX = sourceX + Math.cos(angle) * this.nodeRadius;
      const startY = sourceY + Math.sin(angle) * this.nodeRadius;
      
      const endAngle = Math.atan2(sourceY - targetY, sourceX - targetX);
      const endX = targetX + Math.cos(endAngle) * this.nodeRadius;
      const endY = targetY + Math.sin(endAngle) * this.nodeRadius;
      
      // 其他连接继续使用原来的贝塞尔曲线计算
      const midX = (sourceX + targetX) / 2;
      const midY = (sourceY + targetY) / 2;
      
      if (Math.abs(sourceX - targetX) < 10 || Math.abs(sourceY - targetY) < 10) {
        // 在直线上线性插值
        x = startX + (endX - startX) * t;
        y = startY + (endY - startY) * t;
      } else {
        // 在二次贝塞尔曲线上计算点
        const oneMinusT = 1 - t;
        x = oneMinusT * oneMinusT * startX + 2 * oneMinusT * t * midX + t * t * endX;
        y = oneMinusT * oneMinusT * startY + 2 * oneMinusT * t * midY + t * t * endY;
      }
    }
    
    // 绘制粒子
    ctx.save();
    ctx.beginPath();
    const particleSize = 3;
    ctx.arc(x, y, particleSize, 0, Math.PI * 2);
    ctx.fillStyle = particle.link.color;
    ctx.fill();
    ctx.restore();
  }

  updateParticles() {
    this.particles.forEach(particle => {
      particle.progress += particle.speed;
      if (particle.progress >= 1) {
        particle.progress = 0;
      }
    });
  }

  draw() {
    const { ctx, canvas } = this;
    // 确保Canvas的尺寸正确
    if (canvas.width / canvas.height !== 1.5) {
      // 如果比例不是3:2，重新调整
      canvas.height = Math.floor(canvas.width * 2/3);
    }
    
    // 清除画布
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 绘制连线
    this.links.forEach(link => this.drawLink(link));
    
    // 绘制粒子
    this.particles.forEach(particle => this.drawParticle(particle));
    
    // 绘制节点
    this.nodes.forEach(node => this.drawNode(node));
    
    // 更新粒子位置
    this.updateParticles();
    
    // 继续动画
    this.animationFrameId = requestAnimationFrame(() => this.draw());
  }

  destroy() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    window.removeEventListener('resize', this.resize);
    this.container.removeChild(this.canvas);
  }
}

export default EnergyFlowCanvas;