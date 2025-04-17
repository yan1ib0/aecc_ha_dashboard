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
      this.fetchData()
    }, 60*1000); // 每分钟刷新一次
  }


  resize() {
    const rect = this.container.getBoundingClientRect();
    const width = rect.width;
    // --- 关键：内部 Canvas 高度始终按 2:3 计算 ---
    const internalHeight = Math.max(150, Math.floor(width * 2 / 3)); // 使用 2:3

    // 检查内部尺寸是否变化
    if (this.canvas.width !== width || this.canvas.height !== internalHeight) {
        this.canvas.width = width;
        this.canvas.height = internalHeight; // 设置内部 Canvas 的实际高宽
        // --- 移除对 canvas.style.height 的设置 ---
        // this.canvas.style.height = `${internalHeight}px`; // 不再需要由内部控制样式

        this.updateNodeRadius(); // 基于内部尺寸更新半径

         // 重启动画循环
         if (this.animationFrameId) {
             cancelAnimationFrame(this.animationFrameId);
         }
         this.lastUpdateTime = Date.now();
         this.draw(); // 使用新的内部尺寸开始绘制
    }
  }

  updateNodeRadius() {
    // 计算半径时使用内部 canvas 尺寸
    const minDimension = Math.min(this.canvas.width, this.canvas.height);
    const baseRadius = Math.max(18, Math.min(30, minDimension / 15));
    this.nodeRadius = baseRadius;
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

  drawNode(node) {
    const { ctx } = this;
    ctx.save();

    // 绘制节点圆形背景
    ctx.beginPath();
    ctx.arc(node.x, node.y, this.nodeRadius, 0, Math.PI * 2);
    ctx.fillStyle = 'white'; // 使用白色背景以确保图标清晰
    ctx.fill();
    ctx.strokeStyle = node.color;
    ctx.lineWidth = 2;
    ctx.stroke();

    // 绘制图标
    const icon = this.loadedIcons.get(node.name);
    if (icon) {
      const iconSize = this.nodeRadius * 1.0; // 图标尺寸比例略微调整
      ctx.drawImage(icon, node.x - iconSize / 2, node.y - iconSize / 2, iconSize, iconSize);
    }

    // --- 修改标签和功率位置 ---
    const fontSize = Math.max(12, Math.min(16, this.nodeRadius * 0.5));
    ctx.font = `bold ${fontSize}px Arial`;
    ctx.fillStyle = '#333';
    ctx.textAlign = 'center';

    // 计算文本起始 Y 坐标 (图标下方)
    let textY = node.y + this.nodeRadius + 15; // 基础偏移

    // --- 添加调试日志 ---
    // 打印节点名称和它的 value 属性，以检查数据是否正确传递
    // console.log(`Drawing Node: ${node.name}, Value Received: '${node.value}'`);

    // 绘制节点名称 (在功率上方)
    ctx.fillText(node.name, node.x, textY);
    textY += fontSize + 2; // 增加行间距

    // 绘制功率值 (增加对 value 的检查)
    const nodeValue = node.value; // 获取 value
    const powerValues = typeof nodeValue === 'string' && nodeValue.trim() !== '' ? nodeValue.split('\n') : []; // 确保 value 是非空字符串再分割

    if (powerValues.length === 0 && typeof nodeValue !== 'undefined') { // 如果 value 不是 undefined 但处理后为空数组，也提示一下
        console.warn(`Node ${node.name} has value that resulted in empty powerValues: `, nodeValue);
    }

    powerValues.forEach((valueLine) => { // 使用处理过的 valueLine
      if (typeof valueLine === 'string') { // 确保是字符串
        ctx.fillText(valueLine.trim(), node.x, textY); // trim() 去除可能的前后空格
        textY += fontSize; // 下一行功率值的位置
      }
    });
    // --- 结束修改 ---

    ctx.restore();
  }

  // 绘制连接线，根据要求调整路径（直线或曲线）
  drawLink(link) {
    const { ctx } = this;
    const sourceNode = this.nodes.find(n => n.name === link.source);
    const targetNode = this.nodes.find(n => n.name === link.target);

    if (!sourceNode || !targetNode) return;

    const sourceX = sourceNode.x; const sourceY = sourceNode.y;
    const targetX = targetNode.x; const targetY = targetNode.y;

    const homeNode = this.nodes.find(n => n.name === '家庭负载');
    const gridNode = this.nodes.find(n => n.name === '电网');
    const solarNode = this.nodes.find(n => n.name === '光伏');
    const batteryNode = this.nodes.find(n => n.name === '电池');
    const chargerNode = this.nodes.find(n => n.name === '充电桩');
    const smartNode = this.nodes.find(n => n.name === '智能负载');

    ctx.save();
    ctx.strokeStyle = link.color;
    const baseLineWidth = 1; const maxLineWidth = 4;
    const powerFactor = Math.min(1, Math.abs(link.value) / 1000);
    const lineWidth = baseLineWidth + (maxLineWidth - baseLineWidth) * powerFactor;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath();

    let startX, startY, endX, endY, cp1x, cp1y, cp2x, cp2y;
    const radius = this.nodeRadius;
    const angle = Math.atan2(targetY - sourceY, targetX - sourceX);


    // --- 根据连接类型绘制路径 ---

    // 1. 电网 -> 家庭负载 (曲线)
    if (link.source === '电网' && link.target === '家庭负载' && gridNode && homeNode) {
        startX = gridNode.x + radius; startY = gridNode.y; endX = homeNode.x - radius; endY = homeNode.y;
        cp1x = startX + (endX - startX) * 0.5; cp1y = startY; cp2x = cp1x; cp2y = endY;
        ctx.moveTo(startX, startY); ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, endX, endY);
    }
    // 2. 光伏 -> 家庭负载 (曲线 - 基准样式)
    else if (link.source === '光伏' && link.target === '家庭负载' && solarNode && homeNode) {
        startX = solarNode.x; startY = solarNode.y + radius; endX = homeNode.x; endY = homeNode.y - radius;
        cp1x = startX; cp1y = startY + (endY - startY) * 0.5; cp2x = endX; cp2y = cp1y;
        ctx.moveTo(startX, startY); ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, endX, endY);
    }
    // 3. 电池 -> 家庭负载 (曲线 - 基准样式)
    else if (link.source === '电池' && link.target === '家庭负载' && batteryNode && homeNode) {
        startX = batteryNode.x; startY = batteryNode.y - radius; endX = homeNode.x; endY = homeNode.y + radius;
        cp1x = startX; cp1y = startY + (endY - startY) * 0.5; cp2x = endX; cp2y = cp1y;
        ctx.moveTo(startX, startY); ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, endX, endY);
    }
    // 4. 家庭负载 -> 充电桩 (直线)
    else if (link.source === '家庭负载' && link.target === '充电桩' && homeNode && chargerNode) {
        startX = sourceX + Math.cos(angle) * radius; startY = sourceY + Math.sin(angle) * radius;
        endX = targetX - Math.cos(angle) * radius; endY = targetY - Math.sin(angle) * radius;
        ctx.moveTo(startX, startY); ctx.lineTo(endX, endY);
    }
    // 5. 家庭负载 -> 智能负载 (直线)
    else if (link.source === '家庭负载' && link.target === '智能负载' && homeNode && smartNode) {
        startX = sourceX + Math.cos(angle) * radius; startY = sourceY + Math.sin(angle) * radius;
        endX = targetX - Math.cos(angle) * radius; endY = targetY - Math.sin(angle) * radius;
        ctx.moveTo(startX, startY); ctx.lineTo(endX, endY);
    }
    // 6. 光伏 -> 电池 (直线)
    else if (link.source === '光伏' && link.target === '电池' && solarNode && batteryNode) {
        startX = sourceX + Math.cos(angle) * radius; startY = sourceY + Math.sin(angle) * radius;
        endX = targetX - Math.cos(angle) * radius; endY = targetY - Math.sin(angle) * radius;
        ctx.moveTo(startX, startY); ctx.lineTo(endX, endY);
    }
    // 7. 光伏 -> 电网 (曲线 - 对称于 PV -> Load)
    else if (link.source === '光伏' && link.target === '电网' && solarNode && gridNode) {
       startX = solarNode.x; startY = solarNode.y + radius;
       endX = gridNode.x; endY = gridNode.y - radius;
       cp1x = startX; cp1y = startY + (endY - startY) * 0.5;
       cp2x = endX; cp2y = cp1y;
      ctx.moveTo(startX, startY);
      ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, endX, endY);
    }
    // 8. 电池 -> 电网 (曲线 - 对称于 Battery -> Load)
    else if (link.source === '电池' && link.target === '电网' && batteryNode && gridNode) {
       // 对称逻辑:
       // Bat->Load: start(Bat_x, Bat_y-r), end(Load_x, Load_y+r), cp1(Bat_x, midY), cp2(Load_x, midY)
       // Bat->Grid: start(Bat_x, Bat_y-r), end(Grid_x, Grid_y+r), cp1(Bat_x, midY), cp2(Grid_x, midY)
       startX = batteryNode.x; startY = batteryNode.y - radius; // 从电池上方出 (与 Bat->Load 相同)
       endX = gridNode.x; endY = gridNode.y + radius;       // 进入电网下方 (对称 Load_y+r)
       cp1x = startX; // 控制点1 x 与起点相同 (对称)
       cp1y = startY + (endY - startY) * 0.5; // 控制点1 y 在新的起点和终点y的中间 (对称计算方式)
       cp2x = endX; // 控制点2 x 与终点相同 (对称)
       cp2y = cp1y; // 控制点2 y 与 控制点1 y 相同 (对称)

      ctx.moveTo(startX, startY);
      ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, endX, endY);
    }
    // 9. 电网 -> 电池 (曲线 - 反向对称于 Battery -> Grid)
    else if (link.source === '电网' && link.target === '电池' && gridNode && batteryNode) {
        // 反向对称逻辑:
        // Bat->Grid: start(Bat_x, Bat_y-r), end(Grid_x, Grid_y+r), cp1(Bat_x, midY), cp2(Grid_x, midY)
        // Grid->Bat: start(Grid_x, Grid_y+r), end(Bat_x, Bat_y-r), cp1(Grid_x, midY), cp2(Bat_x, midY)
        startX = gridNode.x; startY = gridNode.y + radius; // 从电网下方出
        endX = batteryNode.x; endY = batteryNode.y - radius; // 进入电池上方

        cp1x = startX; // 控制点1 x 与起点相同
        cp1y = startY + (endY - startY) * 0.5; // 控制点1 y 在新的起点和终点y的中间
        cp2x = endX; // 控制点2 x 与终点相同
        cp2y = cp1y; // 控制点2 y 与 控制点1 y 相同

      ctx.moveTo(startX, startY);
      ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, endX, endY);
    }
    // 其他未处理的连接（默认直线）
    else {
        startX = sourceX + Math.cos(angle) * radius; startY = sourceY + Math.sin(angle) * radius;
        endX = targetX - Math.cos(angle) * radius; endY = targetY - Math.sin(angle) * radius;
        if (!isNaN(startX) && !isNaN(startY) && !isNaN(endX) && !isNaN(endY)) {
          ctx.moveTo(startX, startY); ctx.lineTo(endX, endY);
        }
    }

    if (!isNaN(startX) && !isNaN(startY)) {
    ctx.stroke();
    }
    ctx.restore();
  }

  // 根据进度计算路径上的点 (匹配 drawLink 的直线/曲线逻辑)
  getPointOnPath(link, progress) {
    // --- 使用一个非常简单的日志来测试 ---
    // console.log("!!! getPointOnPath CALLED !!!", link.source, "->", link.target);

    const sourceNode = this.nodes.find(n => n.name === link.source);
    const targetNode = this.nodes.find(n => n.name === link.target);

    if (!sourceNode || !targetNode) {
      return { x: 0, y: 0 };
    }

    const sourceX = sourceNode.x; const sourceY = sourceNode.y;
    const targetX = targetNode.x; const targetY = targetNode.y;
    const radius = this.nodeRadius;

    const homeNode = this.nodes.find(n => n.name === '家庭负载');
    const gridNode = this.nodes.find(n => n.name === '电网');
    const solarNode = this.nodes.find(n => n.name === '光伏');
    const batteryNode = this.nodes.find(n => n.name === '电池');

    let startX, startY, endX, endY, cp1x, cp1y, cp2x, cp2y;
    let pathType = 'line';
    const angle = Math.atan2(targetY - sourceY, targetX - sourceX);

    const bezierXY = (t, sx, sy, cp1x, cp1y, cp2x, cp2y, ex, ey) => {
        const mt = 1 - t; const mt2 = mt * mt; const mt3 = mt2 * mt;
        const t2 = t * t; const t3 = t2 * t;
        return {
            x: mt3 * sx + 3 * mt2 * t * cp1x + 3 * mt * t2 * cp2x + t3 * ex,
            y: mt3 * sy + 3 * mt2 * t * cp1y + 3 * mt * t2 * cp2y + t3 * ey
        };
    };

    // --- 根据连接类型确定路径参数 ---
    if (link.source === '电网' && link.target === '家庭负载' && gridNode && homeNode) { pathType = 'bezier'; startX = gridNode.x + radius; startY = gridNode.y; endX = homeNode.x - radius; endY = homeNode.y; cp1x = startX + (endX - startX) * 0.5; cp1y = startY; cp2x = cp1x; cp2y = endY; }
    else if (link.source === '光伏' && link.target === '家庭负载' && solarNode && homeNode) { pathType = 'bezier'; startX = solarNode.x; startY = solarNode.y + radius; endX = homeNode.x; endY = homeNode.y - radius; cp1x = startX; cp1y = startY + (endY - startY) * 0.5; cp2x = endX; cp2y = cp1y; }
    else if (link.source === '电池' && link.target === '家庭负载' && batteryNode && homeNode) { pathType = 'bezier'; startX = batteryNode.x; startY = batteryNode.y - radius; endX = homeNode.x; endY = homeNode.y + radius; cp1x = startX; cp1y = startY + (endY - startY) * 0.5; cp2x = endX; cp2y = cp1y; }
    else if (link.source === '家庭负载' && link.target === '充电桩') { pathType = 'line'; startX = sourceX + Math.cos(angle) * radius; startY = sourceY + Math.sin(angle) * radius; endX = targetX - Math.cos(angle) * radius; endY = targetY - Math.sin(angle) * radius; }
    else if (link.source === '家庭负载' && link.target === '智能负载') { pathType = 'line'; startX = sourceX + Math.cos(angle) * radius; startY = sourceY + Math.sin(angle) * radius; endX = targetX - Math.cos(angle) * radius; endY = targetY - Math.sin(angle) * radius; }
    else if (link.source === '光伏' && link.target === '电池') { pathType = 'line'; startX = sourceX + Math.cos(angle) * radius; startY = sourceY + Math.sin(angle) * radius; endX = targetX - Math.cos(angle) * radius; endY = targetY - Math.sin(angle) * radius; }
    else if (link.source === '光伏' && link.target === '电网' && solarNode && gridNode) { pathType = 'bezier'; startX = solarNode.x; startY = solarNode.y + radius; endX = gridNode.x; endY = gridNode.y - radius; cp1x = startX; cp1y = startY + (endY - startY) * 0.5; cp2x = endX; cp2y = cp1y; }
    else if (link.source === '电池' && link.target === '电网' && batteryNode && gridNode) { pathType = 'bezier'; startX = batteryNode.x; startY = batteryNode.y - radius; endX = gridNode.x; endY = gridNode.y + radius; cp1x = startX; cp1y = startY + (endY - startY) * 0.5; cp2x = endX; cp2y = cp1y; }
    else if (link.source === '电网' && link.target === '电池' && gridNode && batteryNode) { pathType = 'bezier'; startX = gridNode.x; startY = gridNode.y + radius; endX = batteryNode.x; endY = batteryNode.y - radius; cp1x = startX; cp1y = startY + (endY - startY) * 0.5; cp2x = endX; cp2y = cp1y; }
    else { pathType = 'line'; startX = sourceX + Math.cos(angle) * radius; startY = sourceY + Math.sin(angle) * radius; endX = targetX - Math.cos(angle) * radius; endY = targetY - Math.sin(angle) * radius; }

    // --- 根据 pathType 计算最终坐标 ---
    if (isNaN(startX) || isNaN(startY) || isNaN(endX) || isNaN(endY)) {
        return { x: sourceX, y: sourceY };
    }
    if (pathType === 'bezier') {
        if (cp1x === undefined || cp1y === undefined || cp2x === undefined || cp2y === undefined) {
            return { x: startX + (endX - startX) * progress, y: startY + (endY - startY) * progress };
        }
        return bezierXY(progress, startX, startY, cp1x, cp1y, cp2x, cp2y, endX, endY);
    } else { // 'line'
        return { x: startX + (endX - startX) * progress, y: startY + (endY - startY) * progress };
    }
  }

  // 更新粒子位置和状态
  updateParticles(deltaTime) {
    // console.log(`--- updateParticles called, deltaTime: ${deltaTime}, particle count: ${this.particles.length} ---`); // 添加日志

    if (this.particles.length === 0) {
        // console.warn("Particle array is empty, skipping update.");
        return; // 如果没有粒子，直接返回
    }

    this.particles.forEach(particle => {
      try { // 添加 try...catch 块捕获潜在错误
      // 更新粒子进度
          const speed = typeof particle.speed === 'number' ? particle.speed : 0;
          const dt = typeof deltaTime === 'number' && deltaTime > 0 ? deltaTime : 16; // Use a default delta if invalid
          particle.progress += (speed * dt) / 1000;

      // 循环进度
      if (particle.progress > 1) particle.progress -= 1;
          if (particle.progress < 0) particle.progress += 1;

      // 使用新函数计算精确位置
          const pos = this.getPointOnPath(particle.link, particle.progress); // 调用 getPointOnPath
      particle.x = pos.x;
      particle.y = pos.y;

      } catch (error) {
          console.error("Error updating particle:", particle, error); // 打印错误信息
      }
    });
  }

  // 绘制单个粒子
  drawParticle(particle) {
    const { ctx } = this;
    if (particle.x === undefined || particle.y === undefined || isNaN(particle.x) || isNaN(particle.y)) {
      return;
    }
    ctx.save();
    ctx.beginPath();
    const particleRadius = typeof particle.size === 'number' && particle.size > 0 ? particle.size : 3;
    ctx.arc(particle.x, particle.y, particleRadius, 0, Math.PI * 2);
    ctx.fillStyle = particle.link?.color || '#ccc';
    ctx.fill();
    ctx.restore();
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

    // 更新粒子位置
    this.updateParticles(deltaTime);

    // 绘制连线 (移除 if(link.visible) 判断)
    this.links.forEach(link => {
       // 不再需要 if (link.visible)
       this.drawLink(link); // 直接绘制所有连线
    });

    // 绘制粒子
    this.particles.forEach(particle => {
      this.drawParticle(particle);
    });

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
      }
      this.initParticles();
    } catch (error) {
      console.error('获取数据失败:', error);
    }
  }
  initParticles() {
    console.log("--- initParticles called ---"); // 添加日志
    this.particles = []; // 清空粒子数组
    console.log("Links to initialize particles for:", this.links); // 打印用于生成粒子的 links

    if (!this.links || this.links.length === 0) {
        console.warn("No links available to initialize particles.");
        return;
    }

    this.links.forEach(link => {
      // 检查 link 和 link.value 是否有效
      if (!link || typeof link.value !== 'number') {
          console.warn("Skipping particle initialization for invalid link:", link);
          return; // 跳过无效的 link
      }

    const sourceNode = this.nodes.find(n => n.name === link.source);
    const targetNode = this.nodes.find(n => n.name === link.target);
      if (!sourceNode || !targetNode) {
          console.warn(`Nodes not found for link ${link.source}->${link.target}, skipping particles.`);
          return; // 如果找不到节点，也跳过
      }

      // 根据功率绝对值决定粒子数量，确保至少有1个粒子（如果功率非0）
       const powerAbs = Math.abs(link.value);
       const particleCount = powerAbs > 1 ? Math.min(15, Math.max(1, Math.floor(powerAbs / 100))) : 0; // 调整数量计算逻辑，功率低则少，为0则无
       // const particleCount = Math.min(10, Math.max(3, Math.abs(link.value) / 200)); // 原来的计算方式

       if (particleCount === 0) {
           // console.log(`Skipping particles for link ${link.source}->${link.target} due to low/zero power (${link.value})`);
           return;
       }


      // 粒子速度和方向
      const direction = link.value >= 0 ? 1 : -1; // 正值: source->target, 负值: target->source (虽然动画只看方向)
      // 基础速度，可根据功率调整，确保非零
      const baseSpeed = 0.05 + Math.min(0.15, powerAbs / 5000); // 稍微加速

      console.log(`Initializing ${particleCount} particles for ${link.source} -> ${link.target} (value: ${link.value})`); // 打印粒子创建信息

      for (let i = 0; i < particleCount; i++) {
        this.particles.push({
          link: link, // 引用 link 对象
          progress: Math.random(), // 随机初始位置
          speed: baseSpeed * direction, // 基础速度 * 方向
          size: 2 + Math.random() * 1.5, // 随机大小 (略微减小)
           // x, y 将在 updateParticles 中计算
        });
      }
    });
    console.log(`--- initParticles finished. Total particles: ${this.particles.length} ---`); // 结束日志
  }
}
export default EnergyFlowCanvas;
