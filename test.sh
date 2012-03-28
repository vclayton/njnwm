Xephyr -screen 800x600 -br -reset -terminate :20 &
sleep 1
#DISPLAY=:20 xterm &
DISPLAY=:20 node njnwm.js
