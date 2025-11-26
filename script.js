const API_STATUS = '/api/status';
const API_CONTROL = '/api/control';
const UPDATE_INTERVAL = 3000; // Cập nhật mỗi 3 giây

const elements = {
    temp: document.getElementById('temp-value'),
    humid: document.getElementById('humid-value'),
    light: document.getElementById('light-value'),
    soil: document.getElementById('soil-value'),
    irrigationBtn: document.getElementById('irrigation-btn'),
    lightBtn: document.getElementById('light-btn'),
    connStatus: document.getElementById('conn-status'),
    lastUpdate: document.getElementById('last-update'),
    logMessage: document.getElementById('log-message')
};

/**
 * Cập nhật trạng thái Actuator (màu sắc và chữ) dựa trên dữ liệu từ API.
 * @param {string} type - 'irrigation' hoặc 'light'
 * @param {boolean} isOn - Trạng thái ON/OFF
 */
function updateActuatorUI(type, isOn) {
    const btn = elements[`${type}Btn`];
    const state = isOn ? 'on' : 'off';
    const text = isOn 
        ? (type === 'irrigation' ? 'TẮT TƯỚI TIÊU' : 'TẮT ĐÈN VƯỜN') 
        : (type === 'irrigation' ? 'BẬT TƯỚI TIÊU' : 'BẬT ĐÈN VƯỜN');

    btn.className = `actuator-btn ${type} ${state}`;
    btn.querySelector('.btn-text').textContent = text;
}

/**
 * Gửi yêu cầu GET đến ESP32 để lấy dữ liệu cảm biến mới nhất.
 */
async function fetchSensorData() {
    try {
        const response = await fetch(API_STATUS);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        const now = new Date().toLocaleTimeString('vi-VN');

        // 1. Cập nhật dữ liệu cảm biến
        elements.temp.textContent = `${data.temperature_C.toFixed(1)} °C`;
        elements.humid.textContent = `${data.humidity_percent.toFixed(1)} %`;
        elements.light.textContent = `${data.light_lux} Lux`;
        elements.soil.textContent = `${data.soil_moisture_percent} %`;

        // 2. Cập nhật trạng thái Actuator (Do STM32 quản lý và gửi lại)
        updateActuatorUI('irrigation', data.irrigation_on);
        updateActuatorUI('light', data.light_on);

        // 3. Cập nhật trạng thái kết nối
        elements.connStatus.textContent = 'Đã kết nối';
        elements.connStatus.className = 'status-ok';
        elements.lastUpdate.textContent = now;

    } catch (error) {
        elements.connStatus.textContent = 'Lỗi: Mất kết nối ESP32';
        elements.connStatus.className = 'status-error';
        elements.logMessage.textContent = `[${new Date().toLocaleTimeString()}] Lỗi truy cập API.`;
        console.error("Fetch Error:", error);
    }
}

/**
 * Gửi lệnh điều khiển POST đến ESP32.
 * @param {string} actuatorType - 'irrigation' hoặc 'light'
 * @param {boolean} targetState - true cho 'ON', false cho 'OFF'
 */
async function sendControlCommand(actuatorType, targetState) {
    const command = {
        actuator: actuatorType,
        state: targetState ? 'ON' : 'OFF'
    };

    elements.logMessage.textContent = `Đang gửi lệnh: ${actuatorType} ${command.state}...`;

    try {
        const response = await fetch(API_CONTROL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(command)
        });

        const result = await response.json();

        if (response.ok && result.status === 'ok') {
            elements.logMessage.textContent = `[${new Date().toLocaleTimeString()}] Gửi lệnh thành công: ${actuatorType} ${command.state}. Chờ STM32 phản hồi trạng thái mới.`;
        } else {
            throw new Error(`Lỗi server: ${result.message || 'Không rõ'}`);
        }
    } catch (error) {
        elements.logMessage.textContent = `[${new Date().toLocaleTimeString()}] Lỗi gửi lệnh: ${error.message}`;
        console.error("Control Command Error:", error);
    }
}

// Gán sự kiện click cho các nút
elements.irrigationBtn.addEventListener('click', function() {
    // Xác định trạng thái hiện tại từ class
    const isCurrentlyOn = this.classList.contains('on');
    sendControlCommand('irrigation', !isCurrentlyOn);
});

elements.lightBtn.addEventListener('click', function() {
    const isCurrentlyOn = this.classList.contains('on');
    sendControlCommand('light', !isCurrentlyOn);
});

// Bắt đầu quá trình polling
setInterval(fetchSensorData, UPDATE_INTERVAL);
fetchSensorData(); // Gọi lần đầu tiên khi tải trang