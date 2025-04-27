# AECC Energy Management System

AECC能源管理系统是一个Home Assistant自定义面板，提供能源流动可视化、设备状态监控和AI绿色计划管理功能。

## 功能特点

- 能源流动图：实时显示电网、太阳能、电池和负载之间的能源流动
- 设备状态监控：监控逆变器、电池、充电器和负载的状态
- AI绿色计划：管理能源使用计划和模式
- 响应式设计：适配桌面和移动设备
- 深色模式支持：自动适应Home Assistant主题

## 安装方法


### 手动安装

1. 下载`vue-card-panel.js`文件
2. 将文件放入Home Assistant的`www`目录
3. 在`configuration.yaml`中添加以下配置：

```yaml
panel_custom:
  - name: aecc-ha-panel
    sidebar_title: AECC-Dashborad
    sidebar_icon: mdi:chart-donut
    module_url: /local/aecc-ha-panel.mjs
```
4. 重启Home Assistant

## 使用方法

1. 安装完成后，在侧边栏中点击"AECC Energy Management"
2. 查看能源流动图和设备状态
3. 使用开关按钮控制充电器和负载
4. 在AI绿色计划卡片中管理能源使用计划

## 支持

如有问题或建议，请提交Issue或联系支持团队。

## 许可证

MIT License
