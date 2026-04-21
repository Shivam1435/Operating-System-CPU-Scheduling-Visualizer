const state = {
  processes: [],
  results: null,
};

const sampleProcesses = [
  { id: "P1", arrivalTime: 0, burstTime: 7, priority: 2 },
  { id: "P2", arrivalTime: 2, burstTime: 4, priority: 1 },
  { id: "P3", arrivalTime: 4, burstTime: 1, priority: 3 },
  { id: "P4", arrivalTime: 5, burstTime: 4, priority: 2 },
];

const palette = [
  "linear-gradient(135deg, #6ee7b7, #34d399)",
  "linear-gradient(135deg, #7dd3fc, #38bdf8)",
  "linear-gradient(135deg, #fcd34d, #f59e0b)",
  "linear-gradient(135deg, #f9a8d4, #fb7185)",
  "linear-gradient(135deg, #c4b5fd, #8b5cf6)",
  "linear-gradient(135deg, #fdba74, #f97316)",
];

const processForm = document.getElementById("processForm");
const processTableBody = document.getElementById("processTableBody");
const processCount = document.getElementById("processCount");
const resultsTableBody = document.getElementById("resultsTableBody");
const metricsCards = document.getElementById("metricsCards");
const ganttChart = document.getElementById("ganttChart");
const algorithmSelect = document.getElementById("algorithm");
const modeSelect = document.getElementById("mode");
const quantumField = document.getElementById("quantumField");
const activeAlgorithm = document.getElementById("activeAlgorithm");

processForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const requestedId =
    document.getElementById("processId").value.trim() || `P${state.processes.length + 1}`;
  const process = {
    id: createUniqueProcessId(requestedId),
    arrivalTime: Number(document.getElementById("arrivalTime").value),
    burstTime: Number(document.getElementById("burstTime").value),
    priority: Number(document.getElementById("priority").value),
  };

  if (!process.id || process.burstTime <= 0 || process.arrivalTime < 0 || process.priority <= 0) {
    return;
  }

  state.processes.push(process);
  state.results = null;
  processForm.reset();
  document.getElementById("timeQuantum").value = 2;
  renderProcessTable();
  renderResults();
});

document.getElementById("simulateBtn").addEventListener("click", () => {
  if (!state.processes.length) {
    return;
  }

  const algorithm = algorithmSelect.value;
  const mode = modeSelect.value;
  const quantum = Number(document.getElementById("timeQuantum").value) || 1;
  state.results = runSimulation(state.processes, algorithm, mode, quantum);
  renderResults(algorithm, mode);
});

document.getElementById("clearBtn").addEventListener("click", () => {
  state.processes = [];
  state.results = null;
  renderProcessTable();
  renderResults();
});

document.getElementById("loadSampleBtn").addEventListener("click", () => {
  state.processes = sampleProcesses.map((process) => ({ ...process }));
  state.results = null;
  renderProcessTable();
  renderResults();
});

algorithmSelect.addEventListener("change", () => {
  syncControlState();
});

function renderProcessTable() {
  processCount.textContent = `${state.processes.length} Process${state.processes.length === 1 ? "" : "es"}`;

  if (!state.processes.length) {
    processTableBody.innerHTML = `
      <tr class="empty-row">
        <td colspan="5">Add processes to start exploring scheduler behavior.</td>
      </tr>
    `;
    return;
  }

  processTableBody.innerHTML = state.processes
    .map(
      (process, index) => `
        <tr>
          <td>${process.id}</td>
          <td>${process.arrivalTime}</td>
          <td>${process.burstTime}</td>
          <td>${process.priority}</td>
          <td>
            <button class="remove-button" type="button" data-index="${index}">Remove</button>
          </td>
        </tr>
      `
    )
    .join("");

  processTableBody.querySelectorAll(".remove-button").forEach((button) => {
    button.addEventListener("click", () => {
      const index = Number(button.dataset.index);
      state.processes.splice(index, 1);
      state.results = null;
      renderProcessTable();
      renderResults();
    });
  });
}

function renderResults(algorithm, mode) {
  if (!state.results) {
    metricsCards.innerHTML = `
      <article class="metric-card"><span>Average Waiting Time</span><strong>0.00</strong></article>
      <article class="metric-card"><span>Average Turnaround Time</span><strong>0.00</strong></article>
      <article class="metric-card"><span>CPU Utilization</span><strong>0.00%</strong></article>
      <article class="metric-card"><span>Throughput</span><strong>0.00</strong></article>
    `;
    ganttChart.className = "gantt-chart empty-state";
    ganttChart.textContent = "Run a simulation to generate the timeline.";
    activeAlgorithm.textContent = "No Simulation Yet";
    resultsTableBody.innerHTML = `
      <tr class="empty-row">
        <td colspan="5">Metrics for each process will appear here.</td>
      </tr>
    `;
    return;
  }

  const { summary, processMetrics, timeline } = state.results;

  metricsCards.innerHTML = `
    <article class="metric-card"><span>Average Waiting Time</span><strong>${summary.averageWaitingTime.toFixed(2)}</strong></article>
    <article class="metric-card"><span>Average Turnaround Time</span><strong>${summary.averageTurnaroundTime.toFixed(2)}</strong></article>
    <article class="metric-card"><span>CPU Utilization</span><strong>${summary.cpuUtilization.toFixed(2)}%</strong></article>
    <article class="metric-card"><span>Throughput</span><strong>${summary.throughput.toFixed(2)}</strong></article>
  `;

  resultsTableBody.innerHTML = processMetrics
    .map(
      (process) => `
        <tr>
          <td>${process.id}</td>
          <td>${process.completionTime}</td>
          <td>${process.waitingTime}</td>
          <td>${process.turnaroundTime}</td>
          <td>${process.responseTime}</td>
        </tr>
      `
    )
    .join("");

  activeAlgorithm.textContent = algorithmLabel(algorithm, mode);
  ganttChart.className = "gantt-chart";
  ganttChart.innerHTML = `<div class="gantt-track">${timeline
    .map((segment, index) => {
      const color = segment.id === "Idle" ? "" : palette[index % palette.length];
      const width = Math.max(segment.end - segment.start, 1) * 56;
      return `
        <div class="gantt-segment ${segment.id === "Idle" ? "idle" : ""}" style="width:${width}px; background:${color};">
          ${segment.id}
          <span class="gantt-time">${segment.start}</span>
          <span class="gantt-end">${segment.end}</span>
        </div>
      `;
    })
    .join("")}</div>`;
}

function runSimulation(inputProcesses, algorithm, mode, quantum) {
  const baseProcesses = inputProcesses
    .map((process, index) => ({
      ...process,
      originalIndex: index,
      remainingTime: process.burstTime,
      completionTime: 0,
      startTime: null,
    }))
    .sort((left, right) => left.arrivalTime - right.arrivalTime || left.originalIndex - right.originalIndex);

  let scheduled;

  switch (algorithm) {
    case "sjf":
      scheduled = mode === "preemptive" ? simulateSrtf(baseProcesses) : simulateSjf(baseProcesses);
      break;
    case "rr":
      scheduled = simulateRoundRobin(baseProcesses, quantum);
      break;
    case "priority":
      scheduled =
        mode === "preemptive"
          ? simulatePreemptivePriority(baseProcesses)
          : simulatePriority(baseProcesses);
      break;
    case "fcfs":
    default:
      scheduled = simulateFcfs(baseProcesses);
      break;
  }

  return buildMetrics(inputProcesses, scheduled.timeline, scheduled.completedMap);
}

function simulateFcfs(processes) {
  const timeline = [];
  const completedMap = new Map();
  let currentTime = 0;

  for (const process of processes) {
    if (currentTime < process.arrivalTime) {
      pushSegment(timeline, "Idle", currentTime, process.arrivalTime);
      currentTime = process.arrivalTime;
    }

    process.startTime ??= currentTime;
    const endTime = currentTime + process.burstTime;
    pushSegment(timeline, process.id, currentTime, endTime);
    currentTime = endTime;
    process.completionTime = currentTime;
    completedMap.set(process.id, { ...process });
  }

  return { timeline, completedMap };
}

function simulateSjf(processes) {
  const timeline = [];
  const completedMap = new Map();
  const pending = [...processes];
  const readyQueue = [];
  let currentTime = 0;

  while (pending.length || readyQueue.length) {
    moveArrivedProcesses(pending, readyQueue, currentTime);

    if (!readyQueue.length) {
      const nextArrival = pending[0].arrivalTime;
      pushSegment(timeline, "Idle", currentTime, nextArrival);
      currentTime = nextArrival;
      continue;
    }

    readyQueue.sort((left, right) => {
      if (left.burstTime !== right.burstTime) {
        return left.burstTime - right.burstTime;
      }
      if (left.arrivalTime !== right.arrivalTime) {
        return left.arrivalTime - right.arrivalTime;
      }
      return left.originalIndex - right.originalIndex;
    });

    const process = readyQueue.shift();
    process.startTime ??= currentTime;
    const endTime = currentTime + process.burstTime;
    pushSegment(timeline, process.id, currentTime, endTime);
    currentTime = endTime;
    process.remainingTime = 0;
    process.completionTime = currentTime;
    completedMap.set(process.id, { ...process });
  }

  return { timeline, completedMap };
}

function simulatePriority(processes) {
  const timeline = [];
  const completedMap = new Map();
  const pending = [...processes];
  const readyQueue = [];
  let currentTime = 0;

  while (pending.length || readyQueue.length) {
    moveArrivedProcesses(pending, readyQueue, currentTime);

    if (!readyQueue.length) {
      const nextArrival = pending[0].arrivalTime;
      pushSegment(timeline, "Idle", currentTime, nextArrival);
      currentTime = nextArrival;
      continue;
    }

    readyQueue.sort((left, right) => {
      if (left.priority !== right.priority) {
        return left.priority - right.priority;
      }
      if (left.arrivalTime !== right.arrivalTime) {
        return left.arrivalTime - right.arrivalTime;
      }
      return left.originalIndex - right.originalIndex;
    });

    const process = readyQueue.shift();
    process.startTime ??= currentTime;
    const endTime = currentTime + process.burstTime;
    pushSegment(timeline, process.id, currentTime, endTime);
    currentTime = endTime;
    process.remainingTime = 0;
    process.completionTime = currentTime;
    completedMap.set(process.id, { ...process });
  }

  return { timeline, completedMap };
}

function simulateSrtf(processes) {
  const timeline = [];
  const completedMap = new Map();
  const pending = [...processes];
  const readyQueue = [];
  let currentTime = 0;

  while (pending.length || readyQueue.length) {
    moveArrivedProcesses(pending, readyQueue, currentTime);

    if (!readyQueue.length) {
      const nextArrival = pending[0].arrivalTime;
      pushSegment(timeline, "Idle", currentTime, nextArrival);
      currentTime = nextArrival;
      continue;
    }

    readyQueue.sort((left, right) => {
      if (left.remainingTime !== right.remainingTime) {
        return left.remainingTime - right.remainingTime;
      }
      if (left.arrivalTime !== right.arrivalTime) {
        return left.arrivalTime - right.arrivalTime;
      }
      return left.originalIndex - right.originalIndex;
    });

    const process = readyQueue.shift();
    process.startTime ??= currentTime;
    pushSegment(timeline, process.id, currentTime, currentTime + 1);
    currentTime += 1;
    process.remainingTime -= 1;

    moveArrivedProcesses(pending, readyQueue, currentTime);

    if (process.remainingTime > 0) {
      readyQueue.push(process);
    } else {
      process.completionTime = currentTime;
      completedMap.set(process.id, { ...process });
    }
  }

  return { timeline, completedMap };
}

function simulatePreemptivePriority(processes) {
  const timeline = [];
  const completedMap = new Map();
  const pending = [...processes];
  const readyQueue = [];
  let currentTime = 0;

  while (pending.length || readyQueue.length) {
    moveArrivedProcesses(pending, readyQueue, currentTime);

    if (!readyQueue.length) {
      const nextArrival = pending[0].arrivalTime;
      pushSegment(timeline, "Idle", currentTime, nextArrival);
      currentTime = nextArrival;
      continue;
    }

    readyQueue.sort((left, right) => {
      if (left.priority !== right.priority) {
        return left.priority - right.priority;
      }
      if (left.arrivalTime !== right.arrivalTime) {
        return left.arrivalTime - right.arrivalTime;
      }
      return left.originalIndex - right.originalIndex;
    });

    const process = readyQueue.shift();
    process.startTime ??= currentTime;
    pushSegment(timeline, process.id, currentTime, currentTime + 1);
    currentTime += 1;
    process.remainingTime -= 1;

    moveArrivedProcesses(pending, readyQueue, currentTime);

    if (process.remainingTime > 0) {
      readyQueue.push(process);
    } else {
      process.completionTime = currentTime;
      completedMap.set(process.id, { ...process });
    }
  }

  return { timeline, completedMap };
}

function simulateRoundRobin(processes, quantum) {
  const timeline = [];
  const completedMap = new Map();
  const pending = [...processes];
  const readyQueue = [];
  let currentTime = 0;

  while (pending.length || readyQueue.length) {
    moveArrivedProcesses(pending, readyQueue, currentTime);

    if (!readyQueue.length) {
      const nextArrival = pending[0].arrivalTime;
      pushSegment(timeline, "Idle", currentTime, nextArrival);
      currentTime = nextArrival;
      moveArrivedProcesses(pending, readyQueue, currentTime);
    }

    if (!readyQueue.length) {
      continue;
    }

    const process = readyQueue.shift();
    process.startTime ??= currentTime;

    const runTime = Math.min(process.remainingTime, quantum);
    const endTime = currentTime + runTime;
    pushSegment(timeline, process.id, currentTime, endTime);
    currentTime = endTime;
    process.remainingTime -= runTime;

    moveArrivedProcesses(pending, readyQueue, currentTime);

    if (process.remainingTime > 0) {
      readyQueue.push(process);
    } else {
      process.completionTime = currentTime;
      completedMap.set(process.id, { ...process });
    }
  }

  return { timeline, completedMap };
}

function moveArrivedProcesses(pending, readyQueue, currentTime) {
  while (pending.length && pending[0].arrivalTime <= currentTime) {
    readyQueue.push(pending.shift());
  }
}

function pushSegment(timeline, id, start, end) {
  if (start === end) {
    return;
  }

  const lastSegment = timeline[timeline.length - 1];
  if (lastSegment && lastSegment.id === id && lastSegment.end === start) {
    lastSegment.end = end;
    return;
  }

  timeline.push({ id, start, end });
}

function buildMetrics(inputProcesses, timeline, completedMap) {
  const processMetrics = inputProcesses.map((process) => {
    const completed = completedMap.get(process.id);
    const turnaroundTime = completed.completionTime - process.arrivalTime;
    const waitingTime = turnaroundTime - process.burstTime;
    const responseTime = completed.startTime - process.arrivalTime;

    return {
      id: process.id,
      completionTime: completed.completionTime,
      waitingTime,
      turnaroundTime,
      responseTime,
    };
  });

  const totalWaiting = processMetrics.reduce((sum, process) => sum + process.waitingTime, 0);
  const totalTurnaround = processMetrics.reduce((sum, process) => sum + process.turnaroundTime, 0);
  const busyTime = inputProcesses.reduce((sum, process) => sum + process.burstTime, 0);
  const startTime = timeline[0]?.start ?? 0;
  const endTime = timeline[timeline.length - 1]?.end ?? 0;
  const totalTime = endTime - startTime;

  return {
    timeline,
    processMetrics,
    summary: {
      averageWaitingTime: totalWaiting / inputProcesses.length,
      averageTurnaroundTime: totalTurnaround / inputProcesses.length,
      cpuUtilization: totalTime ? (busyTime / totalTime) * 100 : 0,
      throughput: totalTime ? inputProcesses.length / totalTime : 0,
    },
  };
}

function algorithmLabel(algorithm, mode) {
  switch (algorithm) {
    case "sjf":
      return mode === "preemptive" ? "Shortest Remaining Time First" : "Shortest Job First";
    case "rr":
      return "Round Robin (Preemptive)";
    case "priority":
      return mode === "preemptive"
        ? "Priority Scheduling (Preemptive)"
        : "Priority Scheduling (Non-Preemptive)";
    case "fcfs":
    default:
      return "First Come First Serve (Non-Preemptive)";
  }
}

function createUniqueProcessId(baseId) {
  if (!state.processes.some((process) => process.id === baseId)) {
    return baseId;
  }

  let suffix = 2;
  let candidate = `${baseId}-${suffix}`;
  while (state.processes.some((process) => process.id === candidate)) {
    suffix += 1;
    candidate = `${baseId}-${suffix}`;
  }
  return candidate;
}

function syncControlState() {
  const algorithm = algorithmSelect.value;
  const usesQuantum = algorithm === "rr";
  const modeDisabled = algorithm === "fcfs" || algorithm === "rr";

  quantumField.style.display = usesQuantum ? "grid" : "none";
  modeSelect.disabled = modeDisabled;

  if (algorithm === "fcfs") {
    modeSelect.value = "non-preemptive";
  } else if (algorithm === "rr") {
    modeSelect.value = "preemptive";
  }
}

syncControlState();
renderProcessTable();
renderResults();
