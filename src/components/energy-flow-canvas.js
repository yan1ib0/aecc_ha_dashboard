import {getEnergyFlowData, getStatusNow, login, stopSessionRenewal} from '../services/api';

class EnergyFlowCanvas {
    constructor(container, plantId) {
        this.container = container;
        this.plantId=plantId;
        console.log('[vue-card-panel] 创建了新的能源流向画布plantId:'+this.plantId)
        // 添加标题元素
        this.titleElement = document.createElement('div');
        this.titleElement.style.textAlign = 'center';
        this.titleElement.style.color = 'var(--primary-text-color)';
        this.titleElement.style.marginBottom = '16px';
        this.titleElement.textContent = 'Energy Flow';
        this.container.appendChild(this.titleElement);
        this.iconMap = {
            'Grid': 'mdi:transmission-tower',
            'Solar': 'mdi:solar-panel',
            'Battery': 'mdi:battery',
            'Home Load': 'mdi:home',
            'Charger': 'mdi:ev-station',
            'Load': 'mdi:power-socket'
        };
        this.loadedIcons = new Map();
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
        this.nodeRadius = 30;  // 默认节点半径
        this.loadedIcons = new Map();
        this.lastUpdateTime = Date.now(); // 初始化上次更新时间戳

        // 初始化数据更新定时器
        this.dataRefreshInterval = null;

        // 登录并获取数据
        this.loginAndFetchData(plantId);

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
        }, 15 * 1000); // 15秒 刷新一次
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
     * 设置节点数据，并根据节点工作模式自动生成链接数据
     * @param {Array} nodes - 节点数据数组，每个节点包含name、value、workMode等属性
     * @param {Array} links - 可选的现有链接数据，若不提供则自动根据节点workMode生成
     */
    setData(nodes, links = null) {
        this.nodes = nodes;

        // 如果提供了links，直接使用，否则根据节点工作模式自动生成
        if (links) {
            this.links = links;
        }
        // console.log('setData设置节点数据:', this.nodes);
        // console.log('setData设置链接数据:', this.links);
        this.loadIcons();
        this.initParticles();
        this.draw();
    }

    loadIcons() {
        this.nodes.forEach(node => {
            const iconName = this.iconMap[node.name];
            if (iconName && !this.loadedIcons.has(node.name)) {
                // HA的图标URL格式
                const iconUrl = `https://cdn.jsdelivr.net/npm/@mdi/svg@7.2.96/svg/${iconName.replace('mdi:', '')}.svg`;
                // 或者使用CDN
                // const iconUrl = `https://cdn.jsdelivr.net/npm/@mdi/svg@7.0.96/svg/${iconName.replace('mdi:', '')}.svg`;

                const img = new Image();
                img.src = iconUrl;
                img.onload = () => {
                    this.loadedIcons.set(node.name, img);
                    this.draw();
                };
            }
        });
    }

    drawNode(node) {
        const {ctx} = this;
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

        const fontSize = Math.max(12, Math.min(16, this.nodeRadius * 0.5));
        ctx.font = `bold ${fontSize}px Arial`;
        ctx.fillStyle = '#333';
        ctx.textAlign = 'center';

        let textY = node.y + this.nodeRadius + 15;

        ctx.fillText(node.name, node.x, textY);
        textY += fontSize + 2;

        const nodeValue = node.value;
        const powerValues = typeof nodeValue === 'string' && nodeValue.trim() !== '' ? nodeValue.split('\n') : [];

        powerValues.forEach((valueLine) => {
            if (typeof valueLine === 'string') {
                ctx.fillText(valueLine.trim(), node.x, textY);
                textY += fontSize;
            }
        });

        ctx.restore();
    }

    drawLink(link) {
        const {ctx} = this;
        const sourceNode = this.nodes.find(n => n.name === link.source);
        const targetNode = this.nodes.find(n => n.name === link.target);

        if (!sourceNode || !targetNode) return;

        const sourceX = sourceNode.x;
        const sourceY = sourceNode.y;
        const targetX = targetNode.x;
        const targetY = targetNode.y;

        const homeNode = this.nodes.find(n => n.name === 'Home Load');
        const gridNode = this.nodes.find(n => n.name === 'Grid');
        const solarNode = this.nodes.find(n => n.name === 'Solar');
        const batteryNode = this.nodes.find(n => n.name === 'Battery');
        const chargerNode = this.nodes.find(n => n.name === 'Charger');
        const smartNode = this.nodes.find(n => n.name === 'Load');

        ctx.save();
        ctx.strokeStyle = link.color;
        const baseLineWidth = 1;
        const maxLineWidth = 4;
        const lineWidth = baseLineWidth + (maxLineWidth - baseLineWidth) * 0.5;
        ctx.lineWidth = lineWidth;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();

        let startX, startY, endX, endY, cp1x, cp1y, cp2x, cp2y;
        const radius = this.nodeRadius;
        const angle = Math.atan2(targetY - sourceY, targetX - sourceX);

        if (link.source === 'Grid' && link.target === 'Home Load' && gridNode && homeNode) {
            startX = gridNode.x + radius;
            startY = gridNode.y;
            endX = homeNode.x - radius;
            endY = homeNode.y;
            cp1x = startX + (endX - startX) * 0.5;
            cp1y = startY;
            cp2x = cp1x;
            cp2y = endY;
            ctx.moveTo(startX, startY);
            ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, endX, endY);
        } else if (link.source === 'Solar' && link.target === 'Home Load' && solarNode && homeNode) {
            startX = solarNode.x;
            startY = solarNode.y + radius;
            endX = homeNode.x;
            endY = homeNode.y - radius;
            cp1x = startX;
            cp1y = startY + (endY - startY) * 0.5;
            cp2x = endX;
            cp2y = cp1y;
            ctx.moveTo(startX, startY);
            ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, endX, endY);
        } else if (link.source === 'Battery' && link.target === 'Home Load' && batteryNode && homeNode) {
            startX = batteryNode.x;
            startY = batteryNode.y - radius;
            endX = homeNode.x;
            endY = homeNode.y + radius;
            cp1x = startX;
            cp1y = startY + (endY - startY) * 0.5;
            cp2x = endX;
            cp2y = cp1y;
            ctx.moveTo(startX, startY);
            ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, endX, endY);
        } else if (link.source === 'Home Load' && link.target === 'Charger' && homeNode && chargerNode) {
            startX = sourceX + Math.cos(angle) * radius;
            startY = sourceY + Math.sin(angle) * radius;
            endX = targetX - Math.cos(angle) * radius;
            endY = targetY - Math.sin(angle) * radius;
            ctx.moveTo(startX, startY);
            ctx.lineTo(endX, endY);
        } else if (link.source === 'Home Load' && link.target === 'Load' && homeNode && smartNode) {
            startX = sourceX + Math.cos(angle) * radius;
            startY = sourceY + Math.sin(angle) * radius;
            endX = targetX - Math.cos(angle) * radius;
            endY = targetY - Math.sin(angle) * radius;
            ctx.moveTo(startX, startY);
            ctx.lineTo(endX, endY);
        } else if (link.source === 'Solar' && link.target === 'Battery' && solarNode && batteryNode) {
            startX = sourceX + Math.cos(angle) * radius;
            startY = sourceY + Math.sin(angle) * radius;
            endX = targetX - Math.cos(angle) * radius;
            endY = targetY - Math.sin(angle) * radius;
            ctx.moveTo(startX, startY);
            ctx.lineTo(endX, endY);
        } else if (link.source === 'Solar' && link.target === 'Grid' && solarNode && gridNode) {
            startX = solarNode.x;
            startY = solarNode.y + radius;
            endX = gridNode.x;
            endY = gridNode.y - radius;
            cp1x = startX;
            cp1y = startY + (endY - startY) * 0.5;
            cp2x = endX;
            cp2y = cp1y;
            ctx.moveTo(startX, startY);
            ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, endX, endY);
        } else if (link.source === 'Battery' && link.target === 'Grid' && batteryNode && gridNode) {
            startX = batteryNode.x;
            startY = batteryNode.y - radius;
            endX = gridNode.x;
            endY = gridNode.y + radius;
            cp1x = startX;
            cp1y = startY + (endY - startY) * 0.5;
            cp2x = endX;
            cp2y = cp1y;
            ctx.moveTo(startX, startY);
            ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, endX, endY);
        } else if (link.source === 'Grid' && link.target === 'Battery' && gridNode && batteryNode) {
            startX = gridNode.x;
            startY = gridNode.y + radius;
            endX = batteryNode.x;
            endY = batteryNode.y - radius;
            cp1x = startX;
            cp1y = startY + (endY - startY) * 0.5;
            cp2x = endX;
            cp2y = cp1y;
            ctx.moveTo(startX, startY);
            ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, endX, endY);
        } else {
            startX = sourceX + Math.cos(angle) * radius;
            startY = sourceY + Math.sin(angle) * radius;
            endX = targetX - Math.cos(angle) * radius;
            endY = targetY - Math.sin(angle) * radius;
            if (!isNaN(startX) && !isNaN(startY) && !isNaN(endX) && !isNaN(endY)) {
                ctx.moveTo(startX, startY);
                ctx.lineTo(endX, endY);
            }
        }

        if (!isNaN(startX) && !isNaN(startY)) {
            ctx.stroke();
        }
        ctx.restore();
    }

    getPointOnPath(link, progress) {
        const sourceNode = this.nodes.find(n => n.name === link.source);
        const targetNode = this.nodes.find(n => n.name === link.target);

        if (!sourceNode || !targetNode) {
            return {x: 0, y: 0};
        }

        const sourceX = sourceNode.x;
        const sourceY = sourceNode.y;
        const targetX = targetNode.x;
        const targetY = targetNode.y;
        const radius = this.nodeRadius;

        const homeNode = this.nodes.find(n => n.name === 'Home Load');
        const gridNode = this.nodes.find(n => n.name === 'Grid');
        const solarNode = this.nodes.find(n => n.name === 'Solar');
        const batteryNode = this.nodes.find(n => n.name === 'Battery');

        let startX, startY, endX, endY, cp1x, cp1y, cp2x, cp2y;
        let pathType = 'line';
        const angle = Math.atan2(targetY - sourceY, targetX - sourceX);

        const bezierXY = (t, sx, sy, cp1x, cp1y, cp2x, cp2y, ex, ey) => {
            const mt = 1 - t;
            const mt2 = mt * mt;
            const mt3 = mt2 * mt;
            const t2 = t * t;
            const t3 = t2 * t;
            return {
                x: mt3 * sx + 3 * mt2 * t * cp1x + 3 * mt * t2 * cp2x + t3 * ex,
                y: mt3 * sy + 3 * mt2 * t * cp1y + 3 * mt * t2 * cp2y + t3 * ey
            };
        };

        if (link.source === 'Grid' && link.target === 'Home Load' && gridNode && homeNode) {
            pathType = 'bezier';
            startX = gridNode.x + radius;
            startY = gridNode.y;
            endX = homeNode.x - radius;
            endY = homeNode.y;
            cp1x = startX + (endX - startX) * 0.5;
            cp1y = startY;
            cp2x = cp1x;
            cp2y = endY;
        } else if (link.source === 'Solar' && link.target === 'Home Load' && solarNode && homeNode) {
            pathType = 'bezier';
            startX = solarNode.x;
            startY = solarNode.y + radius;
            endX = homeNode.x;
            endY = homeNode.y - radius;
            cp1x = startX;
            cp1y = startY + (endY - startY) * 0.5;
            cp2x = endX;
            cp2y = cp1y;
        } else if (link.source === 'Battery' && link.target === 'Home Load' && batteryNode && homeNode) {
            pathType = 'bezier';
            startX = batteryNode.x;
            startY = batteryNode.y - radius;
            endX = homeNode.x;
            endY = homeNode.y + radius;
            cp1x = startX;
            cp1y = startY + (endY - startY) * 0.5;
            cp2x = endX;
            cp2y = cp1y;
        } else if (link.source === 'Home Load' && link.target === 'Charger') {
            pathType = 'line';
            startX = sourceX + Math.cos(angle) * radius;
            startY = sourceY + Math.sin(angle) * radius;
            endX = targetX - Math.cos(angle) * radius;
            endY = targetY - Math.sin(angle) * radius;
        } else if (link.source === 'Home Load' && link.target === 'Load') {
            pathType = 'line';
            startX = sourceX + Math.cos(angle) * radius;
            startY = sourceY + Math.sin(angle) * radius;
            endX = targetX - Math.cos(angle) * radius;
            endY = targetY - Math.sin(angle) * radius;
        } else if (link.source === 'Solar' && link.target === 'Battery') {
            pathType = 'line';
            startX = sourceX + Math.cos(angle) * radius;
            startY = sourceY + Math.sin(angle) * radius;
            endX = targetX - Math.cos(angle) * radius;
            endY = targetY - Math.sin(angle) * radius;
        } else if (link.source === 'Solar' && link.target === 'Grid' && solarNode && gridNode) {
            pathType = 'bezier';
            startX = solarNode.x;
            startY = solarNode.y + radius;
            endX = gridNode.x;
            endY = gridNode.y - radius;
            cp1x = startX;
            cp1y = startY + (endY - startY) * 0.5;
            cp2x = endX;
            cp2y = cp1y;
        } else if (link.source === 'Battery' && link.target === 'Grid' && batteryNode && gridNode) {
            pathType = 'bezier';
            startX = batteryNode.x;
            startY = batteryNode.y - radius;
            endX = gridNode.x;
            endY = gridNode.y + radius;
            cp1x = startX;
            cp1y = startY + (endY - startY) * 0.5;
            cp2x = endX;
            cp2y = cp1y;
        } else if (link.source === 'Grid' && link.target === 'Battery' && gridNode && batteryNode) {
            pathType = 'bezier';
            startX = gridNode.x;
            startY = gridNode.y + radius;
            endX = batteryNode.x;
            endY = batteryNode.y - radius;
            cp1x = startX;
            cp1y = startY + (endY - startY) * 0.5;
            cp2x = endX;
            cp2y = cp1y;
        } else {
            pathType = 'line';
            startX = sourceX + Math.cos(angle) * radius;
            startY = sourceY + Math.sin(angle) * radius;
            endX = targetX - Math.cos(angle) * radius;
            endY = targetY - Math.sin(angle) * radius;
        }

        if (isNaN(startX) || isNaN(startY) || isNaN(endX) || isNaN(endY)) {
            return {x: sourceX, y: sourceY};
        }
        if (pathType === 'bezier') {
            if (cp1x === undefined || cp1y === undefined || cp2x === undefined || cp2y === undefined) {
                return {x: startX + (endX - startX) * progress, y: startY + (endY - startY) * progress};
            }
            return bezierXY(progress, startX, startY, cp1x, cp1y, cp2x, cp2y, endX, endY);
        } else {
            return {x: startX + (endX - startX) * progress, y: startY + (endY - startY) * progress};
        }
    }

    updateParticles(deltaTime) {
        if (this.particles.length === 0) {
            return;
        }

        this.particles.forEach(particle => {
            try {
                const speed = typeof particle.speed === 'number' ? particle.speed : 0;
                const dt = typeof deltaTime === 'number' && deltaTime > 0 ? deltaTime : 16;
                particle.progress += (speed * dt) / 1000;

                if (particle.progress > 1) particle.progress -= 1;
                if (particle.progress < 0) particle.progress += 1;

                const pos = this.getPointOnPath(particle.link, particle.progress);
                particle.x = pos.x;
                particle.y = pos.y;

            } catch (error) {
                console.error("Error updating particle:", particle, error);
            }
        });
    }

    drawParticle(particle) {
        const {ctx} = this;
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
        const {ctx, canvas} = this;
        const now = Date.now();
        const deltaTime = now - this.lastUpdateTime;
        this.lastUpdateTime = now;

        if (canvas.width / canvas.height !== 1.5) {
            canvas.height = Math.floor(canvas.width * 2 / 3);
        }

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        this.updateParticles(deltaTime);

        this.links.forEach(link => {
            this.drawLink(link);
        });

        this.particles.forEach(particle => {
            // 开始节点workmode 1 和 结束节点workmode -1 才渲染
            // workmode 从nodes 里找
            const sourceNode = this.nodes.find(n => n.name === particle.link.source);
            const targetNode = this.nodes.find(n => n.name === particle.link.target);

            if (sourceNode.workMode === 1 && targetNode.workMode === -1){
                this.drawParticle(particle);
            }
            if(sourceNode.name === 'Home Load' && targetNode.workMode === 1){
                this.drawParticle(particle);
            }
        });

        this.nodes.forEach(node => this.drawNode(node));

        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
        }
        this.animationFrameId = requestAnimationFrame(() => this.draw());
    }

    async loginAndFetchData(plantId) {
        try {

            // 请求并渲染数据
            await this.fetchData(plantId);
        } catch (error) {
            console.error('登录失败:', error);
        } finally {
            this.lastUpdateTime = Date.now();
            this.draw();
        }
    }

    async fetchData(plantId) {
        try {
            console.log('开始获取能流图数据...this.plantId'+this.plantId+',plantId'+plantId)
            const flowData = await getEnergyFlowData(this.plantId?this.plantId:plantId);
            if (flowData) {
                // console.log('获取到能流图数据:', flowData);

                let {
                    gridPower,
                    gridWorkMode,
                    solarPower,
                    solarWorkMode,
                    loadPower,
                    loadWorkMode,
                    homePower,
                    homeWorkMode,
                    batPower,
                    batWorkMode,
                    chargerList,
                } = flowData;
                // console.log("workmode:Grid="+gridWorkMode+" Solar="+solarWorkMode+" Battery="+batWorkMode+" Load="+loadWorkMode+" Home Load="+homeWorkMode);
                const chargerPower = chargerList?.reduce((sum, charger) => sum + (charger.power || 0), 0) || 0;
                let chargerWorkMode=0;
                if(!chargerPower)
                    chargerWorkMode = -1;
                batWorkMode= -batWorkMode
                loadWorkMode=-loadWorkMode
                gridPower = Number(gridPower.replace('W', ''));
                solarPower = Number(solarPower.replace('W', ''));
                batPower = Number(batPower.replace('W', ''));
                loadPower = Number(loadPower.replace('W', ''));
                homePower = Number(homePower.replace('W', ''));

                const totalLoadPower = loadPower+homePower+chargerPower;

                const containerWidth = this.canvas.width;
                const calculationHeight = containerWidth * 2 / 3;

                const calculatePosition = (xRatio, yRatio) => ({
                    x: containerWidth * xRatio, y: calculationHeight * yRatio
                });

                const positionRatios = {
                    'grid': [0.15, 0.42],
                    'solar': [0.5, 0.1], // 靠近顶部 (在 2:3 空间内)
                    'battery': [0.5, 0.76], // 靠近底部 (在 2:3 空间内)
                    'home': [0.85, 0.42],
                    'charger': [0.85, 0.1], // 稍微调整以适应 2:3
                    'smart': [0.85, 0.76]  // 稍微调整以适应 2:3
                };

                const getPosition = (name) => {
                    let key;
                    if (name === 'Grid') key = 'grid'; else if (name === 'Solar') key = 'solar'; else if (name === 'Battery') key = 'battery'; else if (name === 'Home Load') key = 'home'; else if (name === 'Charger') key = 'charger'; else if (name === 'Load') key = 'smart'; else key = name.toLowerCase();

                    const ratio = positionRatios[key];
                    return ratio ? calculatePosition(ratio[0], ratio[1]) : calculatePosition(0.5, 0.5);
                };

                const nodes =
                    [
                        {
                            name: 'Grid',
                            value: `${Math.abs(gridPower).toFixed(1)} W`, ...getPosition('Grid'),
                            color: '#673AB7',
                            icon: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZD0iTTEyIDJ2NC4wM0E4IDggMCAwIDAgNi4wNCAxMkgydjJoNC4wM0E4IDggMCAwIDAgMTIgMTkuOTZWMjRoMnYtNC4wM0E4IDggMCAwIDAgMTkuOTYgMTRIMjR2LTJoLTQuMDNBOCA4IDAgMCAwIDE0IDYuMDRWMmgtMnptLTIgMTBhMiAyIDAgMSAxIDIgMiAyIDIgMCAwIDEtMi0yeiIgZmlsbD0iIzY3M0FCNyIvPjwvc3ZnPg==',
                            workMode: parseInt(gridWorkMode)
                        },
                        {
                            name: 'Solar',
                            value: `${solarPower.toFixed(1)} W`, ...getPosition('Solar'),
                            color: '#FF9800',
                            icon: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZD0iTTMuNSAxOGgxN3YyaC0xN3YtMnptMTctMTJoMnYxMGgtMlY2em0tNCAzaDJ2N2gtMlY5em0tNCAtM2gydjEwaC0yVjZ6bS00IDZoMnY0aC0ydi00em0tNCAtM2gydjdIM1Y5eiIgZmlsbD0iI0ZGOTgwMCIvPjwvc3ZnPg==',
                            workMode: parseInt(solarWorkMode)
                        },
                        {
                            name: 'Battery',
                            value: batWorkMode > 0 ? `Discharger: ${batPower.toFixed(1)} W` : `Charger: ${Math.abs(batPower).toFixed(1)} W`, ...getPosition('Battery'),
                            color: '#00BCD4',
                            icon: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZD0iTTE2IDEwSDh2NEgxNnYtNHptLjY3LThIMTVWMGgtNnYySDcuMzNBMS4zMyAxLjMzIDAgMCAwIDYgMy4zM3YxNy4zNGMwIC43My42IDEuMzMgMS4zMyAxLjMzaDkuMzRjLjczIDAgMS4zMy0uNiAxLjMzLTEuMzNWMy4zM0ExLjMzIDEuMzMgMCAwIDAgMTYuNjcgMnoiIGZpbGw9IiMwMEJDRDQiLz48L3N2Zz4=',
                            workMode: parseInt(batWorkMode)
                        },
                        {
                            name: 'Home Load',
                            value: `total: ${totalLoadPower.toFixed(1)} W`, ...getPosition('Home Load'),
                            color: '#00BCD4',
                            icon: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZD0iTTEyIDNMNCAxMHYxMmgxNlYxMGwtOC03em02IDE0aC0zdi01aC02djVINnYtN2w2LTUgNiA1djd6IiBmaWxsPSIjMDBCQ0Q0Ii8+PC9zdmc+',
                            workMode: parseInt(loadWorkMode)
                        },
                        {
                            name: 'Charger',
                            value: `${chargerPower.toFixed(1)} W`, ...getPosition('Charger'),
                            color: '#4CAF50',
                            icon: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZD0iTTEyIDE4SDZWMmgxNHYxNmgtOHptMi01aDJ2LTJoMlY5aC0yVjdoLTJ2MmgtdmwtNC45IDloNi45eiIgZmlsbD0iIzRDQUY1MCIvPjwvc3ZnPg==',
                            workMode: chargerWorkMode
                        },
                        {
                            name: 'Load',
                            value: `${homePower.toFixed(1)} W`, ...getPosition('Load'),
                            color: '#FF5722',
                            icon: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZD0iTTUgM3YxNmgxNlYzSDV6bTE0IDE0SDdWNWgxMnYxMnptLTctMWgyek0xNSA4aDJ2OGgtMlY4ek0xMSA4aDJ2M2gtMnYtM3ptMCA1aDJ2M2gtMnYtM3pNNyA4aDJ2MkgzVjhoNHY1eiIgZmlsbD0iI0ZGNTcyMiIvPjwvc3ZnPg==',
                            workMode: parseInt(homeWorkMode)
                        }
                    ];

                this.setData(nodes);
            }
        } catch (error) {
            console.error('获取数据失败:', error);
        }
    }

    initParticles() {
        // console.log("--- initParticles called ---");
        this.particles = [];

        if (!this.links || this.links.length === 0) {
            console.warn("No links available to initialize particles.");
            return;
        }

        this.links.forEach(link => {
            if (!link || typeof link.value !== 'number' || isNaN(link.value)) {
                console.warn("Skipping particle initialization for invalid link value:", link);
                return;
            }

            const sourceNode = this.nodes.find(n => n.name === link.source);
            const targetNode = this.nodes.find(n => n.name === link.target);
            if (!sourceNode || !targetNode) {
                console.warn(`Nodes not found for link ${link.source}->${link.target}, skipping particles.`);
                return;
            }

            const powerValue = Math.abs(link.value);
            const particleCount = powerValue > 1 ? Math.min(15, Math.max(1, Math.floor(powerValue / 100))) : 0;

            if (particleCount === 0) {
                return;
            }

            const direction = 1;

            const baseSpeed = 0.05 + Math.min(0.15, powerValue / 5000);

            // console.log(`Initializing ${particleCount} particles for ${link.source} -> ${link.target} (value: ${link.value})`);

            for (let i = 0; i < particleCount; i++) {
                this.particles.push({
                    link: link, progress: Math.random(), speed: baseSpeed * direction, size: 2 + Math.random() * 1.5
                });
            }
        });

        // console.log(this.particles);
    }
}

export default EnergyFlowCanvas;
