document.addEventListener("DOMContentLoaded", () => {
  const algoTypeSelect = document.getElementById("algoType");
  const quantumGroup = document.getElementById("quantumGroup");
  const quantumInput = document.getElementById("quantumTime");
  const priorityGroup = document.getElementById("priorityGroup");
  const prioritiesInput = document.getElementById("priorities");

  const form = document.querySelector("form");
  const outputSection = document.getElementById("outputSection");
  const resultTableBody = document.querySelector("#resultTable tbody");
  const ganttContainer = document.getElementById("ganttContainer");

  algoTypeSelect.addEventListener("change", () => {
    const value = algoTypeSelect.value;
    
    if (value === "RR") {
      quantumGroup.style.display = "block";
      quantumInput.required = true;
    } else {
      quantumGroup.style.display = "none";
      quantumInput.required = false;
    }

    if (value === "Priority") {
      priorityGroup.style.display = "block";
      prioritiesInput.required = true;
    } else {
      priorityGroup.style.display = "none";
      prioritiesInput.required = false;
    }
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();

    const algo = algoTypeSelect.value;
    const arrivalArr = document.getElementById("arrivalTimes").value.trim().split(/\s+/).map(Number);
    const burstArr = document.getElementById("burstTimes").value.trim().split(/\s+/).map(Number);
    
    if (arrivalArr.length !== burstArr.length || arrivalArr.some(isNaN) || burstArr.some(isNaN)) {
      alert("Error: Arrival and Burst times must have the same count of numbers.");
      return;
    }

    let prioritiesArr = [];
    if (algo === "Priority") {
      prioritiesArr = prioritiesInput.value.trim().split(/\s+/).map(Number);
      if (prioritiesArr.length !== arrivalArr.length || prioritiesArr.some(isNaN)) {
        alert("Error: Priority list count must match the process count.");
        return;
      }
    }

    let quantum = 0;
    if (algo === "RR") {
      quantum = parseInt(quantumInput.value, 10);
      if (isNaN(quantum) || quantum <= 0) {
        alert("Error: Please provide a valid positive integer for Quantum Time.");
        return;
      }
    }

    let processes = arrivalArr.map((at, index) => ({
      id: `P${index + 1}`,
      at: at,
      bt: burstArr[index],
      priority: algo === "Priority" ? prioritiesArr[index] : 0,
      ct: 0,
      tat: 0,
      wt: 0
    }));

    let timeline = [];

    if (algo === "FCFS") {
      timeline = scheduleFCFS(processes);
    } else if (algo === "SJF") {
      timeline = scheduleSJF(processes);
    } else if (algo === "SRTF") {
      timeline = scheduleSRTF(processes);
    } else if (algo === "Priority") {
      timeline = schedulePriority(processes);
    } else if (algo === "RR") {
      timeline = scheduleRR(processes, quantum);
    }

    processes.forEach(p => {
      p.tat = p.ct - p.at;
      p.wt = p.tat - p.bt;
    });

    displayOutput(processes, timeline);
  });

  function scheduleFCFS(processes) {
    let list = [...processes].sort((a, b) => a.at - b.at);
    let currentTime = 0;
    let timeline = [];

    list.forEach(p => {
      if (currentTime < p.at) {
        timeline.push({ id: "Idle", start: currentTime, end: p.at });
        currentTime = p.at;
      }
      let start = currentTime;
      currentTime += p.bt;
      p.ct = currentTime;
      timeline.push({ id: p.id, start: start, end: currentTime });
    });

    return timeline;
  }

  function scheduleSJF(processes) {
    let list = processes.map(p => ({ ...p, finished: false }));
    let currentTime = 0;
    let timeline = [];
    let completed = 0;
    const total = list.length;

    while (completed < total) {
      let available = list.filter(p => !p.finished && p.at <= currentTime);

      if (available.length === 0) {
        let nextArrival = Math.min(...list.filter(p => !p.finished).map(p => p.at));
        timeline.push({ id: "Idle", start: currentTime, end: nextArrival });
        currentTime = nextArrival;
        continue;
      }

      available.sort((a, b) => a.bt - b.bt || a.at - b.at);
      let selected = available[0];
      
      let orig = processes.find(p => p.id === selected.id);
      let start = currentTime;
      currentTime += selected.bt;
      orig.ct = currentTime;
      selected.finished = true;
      completed++;

      timeline.push({ id: selected.id, start: start, end: currentTime });
    }
    return timeline;
  }

  function scheduleSRTF(processes) {
    let list = processes.map(p => ({ ...p, remaining: p.bt }));
    let currentTime = 0;
    let timeline = [];
    let completed = 0;
    const total = list.length;
    let lastActive = null;
    let chunkStart = 0;

    while (completed < total) {
      let available = list.filter(p => p.remaining > 0 && p.at <= currentTime);

      if (available.length === 0) {
        if (lastActive !== "Idle" && lastActive !== null) {
          timeline.push({ id: lastActive, start: chunkStart, end: currentTime });
          lastActive = "Idle";
          chunkStart = currentTime;
        } else if (lastActive === null) {
          lastActive = "Idle";
          chunkStart = currentTime;
        }
        currentTime++;
        continue;
      }

      available.sort((a, b) => a.remaining - b.remaining || a.at - b.at);
      let selected = available[0];

      if (selected.id !== lastActive) {
        if (lastActive !== null) {
          timeline.push({ id: lastActive, start: chunkStart, end: currentTime });
        }
        lastActive = selected.id;
        chunkStart = currentTime;
      }

      selected.remaining--;
      currentTime++;

      if (selected.remaining === 0) {
        let orig = processes.find(p => p.id === selected.id);
        orig.ct = currentTime;
        completed++;
        timeline.push({ id: lastActive, start: chunkStart, end: currentTime });
        lastActive = null; 
      }
    }
    return compressTimeline(timeline);
  }

  function schedulePriority(processes) {
    let list = processes.map(p => ({ ...p, finished: false }));
    let currentTime = 0;
    let timeline = [];
    let completed = 0;
    const total = list.length;

    while (completed < total) {
      let available = list.filter(p => !p.finished && p.at <= currentTime);

      if (available.length === 0) {
        let nextArrival = Math.min(...list.filter(p => !p.finished).map(p => p.at));
        timeline.push({ id: "Idle", start: currentTime, end: nextArrival });
        currentTime = nextArrival;
        continue;
      }

      available.sort((a, b) => a.priority - b.priority || a.at - b.at);
      let selected = available[0];

      let orig = processes.find(p => p.id === selected.id);
      let start = currentTime;
      currentTime += selected.bt;
      orig.ct = currentTime;
      selected.finished = true;
      completed++;

      timeline.push({ id: selected.id, start: start, end: currentTime });
    }
    return timeline;
  }

  function scheduleRR(processes, quantum) {
    let list = processes.map(p => ({ ...p, remaining: p.bt, inQueue: false }));
    let currentTime = 0;
    let timeline = [];
    let readyQueue = [];
    let completed = 0;
    const total = list.length;

    list.forEach(p => {
      if (p.at <= currentTime && !p.inQueue) {
        readyQueue.push(p);
        p.inQueue = true;
      }
    });

    while (completed < total) {
      if (readyQueue.length === 0) {
        let unserved = list.filter(p => p.remaining > 0);
        if (unserved.length > 0) {
          let nextArrival = Math.min(...unserved.map(p => p.at));
          timeline.push({ id: "Idle", start: currentTime, end: nextArrival });
          currentTime = nextArrival;
          
          list.forEach(p => {
            if (p.at <= currentTime && !p.inQueue && p.remaining > 0) {
              readyQueue.push(p);
              p.inQueue = true;
            }
          });
        }
        continue;
      }

      let currentProcess = readyQueue.shift();
      let executionTime = Math.min(currentProcess.remaining, quantum);
      let start = currentTime;
      
      currentTime += executionTime;
      currentProcess.remaining -= executionTime;

      timeline.push({ id: currentProcess.id, start: start, end: currentTime });

      list.forEach(p => {
        if (p.at <= currentTime && !p.inQueue && p.remaining > 0 && p.id !== currentProcess.id) {
          readyQueue.push(p);
          p.inQueue = true;
        }
      });

      if (currentProcess.remaining > 0) {
        readyQueue.push(currentProcess);
      } else {
        let orig = processes.find(p => p.id === currentProcess.id);
        orig.ct = currentTime;
        completed++;
      }
    }
    return compressTimeline(timeline);
  }

  function compressTimeline(timeline) {
    if (timeline.length === 0) return [];
    let compressed = [];
    let current = { ...timeline[0] };

    for (let i = 1; i < timeline.length; i++) {
      if (timeline[i].id === current.id && timeline[i].start === current.end) {
        current.end = timeline[i].end;
      } else {
        if (current.start !== current.end) {
          compressed.push(current);
        }
        current = { ...timeline[i] };
      }
    }
    if (current.start !== current.end) {
      compressed.push(current);
    }
    return compressed;
  }

  function displayOutput(processes, timeline) {
    processes.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
    
    resultTableBody.innerHTML = "";
    processes.forEach(p => {
      const row = `<tr>
        <td>${p.id}</td>
        <td>${p.at}</td>
        <td>${p.bt}</td>
        <td>${p.ct}</td>
        <td>${p.tat}</td>
        <td>${p.wt}</td>
      </tr>`;
      resultTableBody.innerHTML += row;
    });

    ganttContainer.innerHTML = "";
    const chartDiv = document.createElement("div");
    chartDiv.className = "gantt-chart";

const totalDuration = timeline[timeline.length - 1].end;
timeline.forEach((block, index) => {
    const blockWidth = ((block.end - block.start) / totalDuration) * 100;
    const blockEl = document.createElement("div");
    blockEl.className = "gantt-block";
    blockEl.style.width = '${blockWidth}%' ;
    blockEl.innerText = block.id;
    
    if (block.id === "Idle") {
        blockEl.style.backgroundColor = "#95a5a6";
    }
    
    if (index === 0) {
        const startIdx = document.createElement("span");
        startIdx.className = "gantt-start-time";
        startIdx.innerText = block.start;
        blockEl.appendChild(startIdx);
    }
    
    const endIdx = document.createElement("span");
    endIdx.className = "gantt-time";
    endIdx.innerText = block.end;
    blockEl.appendChild(endIdx);
    
    chartDiv.appendChild(blockEl);
});

ganttContainer.appendChild(chartDiv);
outputSection.style.display = "block";
}
});