@echo off
cd /d "%~dp0"
set PORT=3000
set URL=http://localhost:%PORT%/?v=%RANDOM%

echo ========================================
echo 重庆加油优惠情报站 - 本地预览
echo ========================================
echo.
echo 请用浏览器打开（不要双击 index.html）:
echo   %URL%
echo.
echo 右下角应显示版本号 v2025052614
echo 地图放大后标签内可见「活动时间：每周一、三、五」
echo.

start "" "%URL%"

where py >nul 2>&1 && (
  py -m http.server %PORT%
  goto :eof
)
where python >nul 2>&1 && (
  python -m http.server %PORT%
  goto :eof
)
where npx >nul 2>&1 && (
  npx --yes serve . -l %PORT%
  goto :eof
)

echo [错误] 未找到 Python 或 npx，请安装 Python 后重试。
pause
