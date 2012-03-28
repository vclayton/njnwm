Xephyr -screen 800x600 -br -reset -terminate :20 &
sleep 1
DISPLAY=:22 xtrace -D:22 -d:20 -k -n --print-offsets --print-counts -- node njnwm.js
