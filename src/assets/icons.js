// 图标资源配置
export const localIcons = {
  grid: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZD0iTTEyIDJMMiA3djEwbDEwIDV2LTVsMTAtNVY3bC0xMC01em0wIDJ2OGwtOCA0djhsMTAtNXYtOGw4LTR2LThsLTEwIDV6IiBmaWxsPSIjMjBCMkFBIi8+PC9zdmc+',
  solar: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZD0iTTEyIDNMNCA5djEybDggNmw4LTZWOWwtOC02em0wIDJ2MTZsLTYtNC41VjEwbDYtNXoiIGZpbGw9IiNGRkQ3MDAiLz48L3N2Zz4=',
  home: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZD0iTTEyIDNMNCA5djEyaDV2LThoNnY4aDVWOWwtOC02em0wIDJ2MTZsLTYtNC41VjEwbDYtNXoiIGZpbGw9IiMxRTkwRkYiLz48L3N2Zz4=',
  charger: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZD0iTTEyIDJMNCA3djEwbDggNWw4LTVWN2wtOC01em0wIDJ2MTZsLTYtNC41VjEwbDYtNXoiIGZpbGw9IiMzMkNEMzIiLz48L3N2Zz4=',
  battery: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZD0iTTEyIDJMNCA3djEwbDggNWw4LTVWN2wtOC01em0wIDJ2MTZsLTYtNC41VjEwbDYtNXoiIGZpbGw9IiMyMEIyQUEiLz48L3N2Zz4=',
  smart: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZD0iTTEyIDJMNCA3djEwbDggNWw4LTVWN2wtOC01em0wIDJ2MTZsLTYtNC41VjEwbDYtNXoiIGZpbGw9IiNGRjZCNkIiLz48L3N2Zz4='
};

// 节点位置配置
export const positions = {
  grid: [50, 300],
  solar: [50, 100],
  home: [400, 200],
  charger: [250, 350],
  battery: [250, 50],
  smart: [400, 350]
};

// 节点大小配置
export const nodeSize = 40;

// 字体大小配置
export const fontSize = 14;

// 移动端判断
export const isMobile = window.innerWidth <= 200;