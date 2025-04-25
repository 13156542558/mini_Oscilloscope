// 全局变量和常量
const strDw = ["nS", "uS", "mS", "S"];
const container = document.getElementById("container");

// 高亮当前数据点
function highlightPoint(e) {
    Highcharts.charts.forEach(chart => {
        const event = chart.pointer.normalize(e);
        const point = chart.series[0]?.searchPoint(event, true);
        point?.highlight(e);
    });
}

// 添加事件监听器
["mousemove", "touchmove", "touchstart"].forEach(eventType => {
    container.addEventListener(eventType, highlightPoint);
});

/* Highcharts扩展方法 */
// 禁用默认的指针重置行为
Highcharts.Pointer.prototype.reset = function() {
    return undefined;
};

// 增强点的高亮功能
Highcharts.Point.prototype.highlight = function(event) {
    this.onMouseOver();
    this.series.chart.tooltip.refresh(this);
    this.series.chart.xAxis[0].drawCrosshair(event, this);
};

// 同步图表缩放
function syncExtremes(e) {
    if (e.trigger !== "syncExtremes") {
        Highcharts.charts.forEach(chart => {
            if (chart !== this.chart && chart.xAxis[0].setExtremes) {
                chart.xAxis[0].setExtremes(e.min, e.max, undefined, false, {
                    trigger: "syncExtremes"
                });
            }
        });
    }
}

/* 图表相关函数 */
// 清除所有图表
function clearCharts() {
    while(container.firstChild) {
        container.removeChild(container.firstChild);
    }
}

// 添加单个通道图表
function addChannelChart(channelData) {
    const chartDiv = document.createElement("div");
    chartDiv.className = "chart";
    container.appendChild(chartDiv);
    
    return Highcharts.chart(chartDiv, {
        boost: { useGPUTranslations: true },
        chart: {
            type: "line",
            marginLeft: 40,
            spacingTop: 20,
            zoomType: "x",
            spacingBottom: 20,
            panning: { enabled: true, type: "x" },
            panKey: "shift"
        },
        title: {
            text: channelData.name,
            align: "left",
            margin: 0,
            x: 30
        },
        subtitle: {
            text: `时间单位 ${channelData.dw} (按Shift键平移)`,
            align: "right"
        },
        credits: { enabled: false },
        legend: { enabled: false },
        xAxis: {
            gridLineWidth: 1,
            crosshair: true,
            events: { setExtremes: syncExtremes }
        },
        yAxis: { title: { text: "电压 (V)" } },
        series: [{
            data: channelData.data,
            name: channelData.name,
            step: channelData.step
        }]
    });
}

// 添加合并图表
function addCombinedChart(ch1, ch2) {
    const chartDiv = document.createElement("div");
    chartDiv.className = "chart";
    container.appendChild(chartDiv);
    
    Highcharts.chart(chartDiv, {
        boost: { useGPUTranslations: true },
        chart: {
            type: "line",
            marginLeft: 40,
            spacingTop: 20,
            zoomType: "x",
            spacingBottom: 20,
            panning: { enabled: true, type: "x" },
            panKey: "shift"
        },
        title: {
            text: `${ch1.name} & ${ch2.name} 合并波形`,
            align: "left",
            margin: 0,
            x: 30
        },
        subtitle: {
            text: `时间单位 ${ch1.dw} (按Shift键平移)`,
            align: "right"
        },
        credits: { enabled: false },
        legend: { enabled: true },
        xAxis: {
            gridLineWidth: 1,
            crosshair: true,
            events: { setExtremes: syncExtremes }
        },
        yAxis: { title: { text: "电压 (V)" } },
        series: [
            {
                data: ch1.data,
                name: ch1.name,
                step: ch1.step
            },
            {
                data: ch2.data,
                name: ch2.name,
                step: ch2.step
            }
        ]
    });
}

/* 文件处理函数 */
function processCSVData(content) {
    const rows = content.split("\n");
    const channels = {
        ch1: { data: [], name: "", step: "left", dw: "" },
        ch2: { data: [], name: "", step: "left", dw: "" }
    };
    let isDualChannel = false;
    
    rows.forEach((row, i) => {
        const values = row.split(",");
        
        if (i === 0) { // 处理表头
            channels.ch1.name = values[0];
            isDualChannel = values.length === 3;
            
            if (isDualChannel) {
                channels.ch2.name = values[1];
            }
            
            // 计算时间单位
            const sampleRate = values[values.length-1].match(/\d+/)[0];
            let timeUnit = 1e9 / sampleRate;
            let unitIndex = 0;
            
            while (timeUnit / 1000 >= 1) {
                timeUnit /= 1000;
                unitIndex++;
            }
            
            channels.ch1.dw = timeUnit + strDw[unitIndex];
            channels.ch2.dw = channels.ch1.dw;
        } else if (values[0]) { // 处理数据行
            channels.ch1.data.push(parseFloat(values[0]));
            if (isDualChannel && values[1]) {
                channels.ch2.data.push(parseFloat(values[1]));
            }
        }
    });
    
    clearCharts();
    
    const showCH1 = document.getElementById("ch1").checked;
    const showCH2 = document.getElementById("ch2").checked;
    const isDual = isDualChannel && showCH1 && showCH2;
    
    if (showCH1) {
        addChannelChart(channels.ch1);
    }
    if (isDualChannel && showCH2) {
        addChannelChart(channels.ch2);
    }
    if (isDual) {
        addCombinedChart(channels.ch1, channels.ch2);
    }
}

function processExcelData(file) {
    const reader = new FileReader();
    const progress = document.getElementById("pro");
    
    progress.max = file.size;
    progress.value = 0;
    
    reader.onprogress = e => progress.value = e.loaded;
    reader.onload = e => {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
        
        const csvContent = jsonData.map(row => row.join(",")).join("\n");
        processCSVData(csvContent);
    };
    
    reader.readAsArrayBuffer(file);
}

// 文件上传处理
document.getElementById("file1").onchange = function() {
    const file = this.files[0];
    if (!file) return;
    
    const progress = document.getElementById("pro");
    progress.max = file.size;
    progress.value = 0;
    
    if (file.name.endsWith(".csv")) {
        const reader = new FileReader();
        reader.onprogress = e => progress.value = e.loaded;
        reader.onload = e => processCSVData(e.target.result);
        reader.readAsText(file);
    } else if (file.name.endsWith(".xlsx")) {
        processExcelData(file);
    }
};

/* 波形生成函数 */
function generateWaveform() {
    clearCharts();
    
    const fy = parseFloat(document.getElementById("fy").value);
    const fx = parseFloat(document.getElementById("fx").value);
    const phase = parseFloat(document.getElementById("phase").value) * Math.PI / 180;
    const pointCount = 1000;
    const showCH1 = document.getElementById("ch1").checked;
    const showCH2 = document.getElementById("ch2").checked;
    const showCombined = showCH1 && showCH2;
    
    const channels = {
        ch1: {
            name: "CH1",
            step: "left",
            dw: "1mS",
            data: new Array(pointCount)
        },
        ch2: {
            name: "CH2",
            step: "left",
            dw: "1mS",
            data: new Array(pointCount)
        }
    };
    
    // 生成波形数据
    for (let i = 0; i < pointCount; i++) {
        const t = i / 100;
        channels.ch1.data[i] = Math.sin(2 * Math.PI * fx * t);
        channels.ch2.data[i] = Math.sin(2 * Math.PI * fy * t + phase);
    }
    
    // 根据勾选状态显示图表
    if (showCH1) {
        addChannelChart(channels.ch1);
    }
    if (showCH2) {
        addChannelChart(channels.ch2);
    }
    if (showCombined) {
        addCombinedChart(channels.ch1, channels.ch2);
    }
}
