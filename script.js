const $ = id => document.getElementById(id);

const colors = [
  "#2878e5", "#7558d8", "#23a6a1",
  "#e59b40", "#e36f93", "#5068bd"
];

let processNumber = 3;

// ===============================
// NAVIGASI HALAMAN
// ===============================
function showPage(page) {
  document.querySelectorAll(".page").forEach(section => {
    section.classList.toggle("active", section.id === page);
  });

  document.querySelectorAll(".nav").forEach(button => {
    button.classList.toggle("active", button.dataset.page === page);
  });

  const names = {
    dashboard: "Dashboard",
    sjf: "Simulasi SJF",
    mlfq: "Simulasi MLFQ",
    about: "Nama Anggota"
  };

  $("breadcrumb").textContent = names[page] || page;

  if (page === "history") renderHistory();

  window.scrollTo({ top: 0, behavior: "smooth" });
}

document.querySelectorAll("[data-page]").forEach(button => {
  button.addEventListener("click", () => {
    showPage(button.dataset.page);
  });
});

// ===============================
// MEMBUAT BARIS DATA PROSES
// ===============================
function createRow(type, name, arrival, burst) {
  const tbody = $(`${type}-input`);
  const tr = document.createElement("tr");

  const tdName = document.createElement("td");
  tdName.textContent = name;

  const tdArrival = document.createElement("td");
  const inputArrival = document.createElement("input");
  inputArrival.type = "number";
  inputArrival.min = "0";
  inputArrival.step = "1";
  inputArrival.value = arrival;
  inputArrival.className = "input-cell";
  inputArrival.dataset.field = "arrival";
  inputArrival.setAttribute("aria-label", `Arrival Time ${name}`);
  tdArrival.appendChild(inputArrival);

  const tdBurst = document.createElement("td");
  const inputBurst = document.createElement("input");
  inputBurst.type = "number";
  inputBurst.min = "1";
  inputBurst.step = "1";
  inputBurst.value = burst;
  inputBurst.className = "input-cell";
  inputBurst.dataset.field = "burst";
  inputBurst.setAttribute("aria-label", `Burst Time ${name}`);
  tdBurst.appendChild(inputBurst);

  const tdRemove = document.createElement("td");
  const remove = document.createElement("button");
  remove.textContent = "×";
  remove.className = "remove-btn";
  remove.type = "button";
  remove.title = "Hapus proses";

  remove.addEventListener("click", () => {
    if (tbody.children.length <= 1) {
      alert("Minimal harus ada satu proses.");
      return;
    }
    tr.remove();
  });

  tdRemove.appendChild(remove);
  tr.append(tdName, tdArrival, tdBurst, tdRemove);
  tbody.appendChild(tr);
}

function seedTable(type) {
  $( `${type}-input`).innerHTML = "";
  createRow(type, "P1", 0, 5);
  createRow(type, "P2", 1, 3);
  createRow(type, "P3", 2, 2);
}

function addProcess(type) {
  const tbody = $(`${type}-input`);

  if (tbody.children.length >= 12) {
    alert("Maksimal 12 proses.");
    return;
  }

  processNumber++;
  createRow(type, `P${processNumber}`, 0, 1);
}

function resetTable(type) {
  seedTable(type);
  $(`${type}-result`).className = "empty";
  $(`${type}-result`).textContent =
    "Belum ada hasil. Masukkan data proses lalu tekan Hitung Penjadwalan.";

  if (type === "mlfq") {
    $("q1").value = 2;
    $("q2").value = 4;
  }
}

// ===============================
// MEMBACA DAN MEMVALIDASI INPUT
// ===============================
function readProcesses(type) {
  const rows = [
    ...$(`${type}-input`).querySelectorAll("tr")
  ];

  if (rows.length === 0) {
    throw new Error("Masukkan minimal satu proses.");
  }

  return rows.map((tr, index) => {
    const inputs = tr.querySelectorAll("input");
    const arrival = Number(inputs[0].value);
    const burst = Number(inputs[1].value);
    const name = tr.cells[0].textContent.trim();

    if (
      inputs[0].value === "" ||
      inputs[1].value === "" ||
      !Number.isSafeInteger(arrival) ||
      !Number.isSafeInteger(burst) ||
      arrival < 0 ||
      burst < 1
    ) {
      throw new Error(
        `Data ${name || index + 1} tidak valid. AT harus ≥ 0 dan BT harus ≥ 1.`
      );
    }

    return {
      name,
      arrival,
      burst,
      remaining: burst,
      order: index
    };
  });
}

function average(processes, field) {
  return processes.reduce((sum, p) => sum + p[field], 0)
    / processes.length;
}

// ===============================
// ALGORITMA SJF NON-PREEMPTIVE
// ===============================
function runSJF(processes) {
  const pending = processes.map(p => ({ ...p }));
  const completed = [];
  const segments = [];
  let time = 0;

  while (pending.length > 0) {
    const available = pending
      .filter(p => p.arrival <= time)
      .sort((a, b) =>
        a.burst - b.burst ||
        a.arrival - b.arrival ||
        a.order - b.order
      );

    // Jika belum ada proses yang tiba, CPU idle.
    if (available.length === 0) {
      const nextArrival = Math.min(
        ...pending.map(p => p.arrival)
      );

      if (nextArrival > time) {
        segments.push({
          name: "Idle",
          start: time,
          end: nextArrival,
          idle: true
        });
      }

      time = nextArrival;
      continue;
    }

    const p = available[0];
    const index = pending.findIndex(x => x.order === p.order);
    pending.splice(index, 1);

    const start = time;
    time += p.burst;

    segments.push({
      name: p.name,
      start,
      end: time
    });

    const completion = time;
    const turnaround = completion - p.arrival;
    const waiting = turnaround - p.burst;
    const response = start - p.arrival;

    completed.push({
      ...p,
      start,
      completion,
      turnaround,
      waiting,
      response
    });
  }

  return {
    algorithm: "SJF",
    segments,
    rows: completed,
    avgWaiting: average(completed, "waiting"),
    avgTurnaround: average(completed, "turnaround"),
    avgResponse: average(completed, "response")
  };
}

// ===============================
// ALGORITMA MLFQ
// Q1: ROUND ROBIN
// Q2: ROUND ROBIN
// Q3: FCFS SAMPAI SELESAI
// ===============================
function runMLFQ(processes, q1, q2) {
  if (
    !Number.isSafeInteger(q1) ||
    !Number.isSafeInteger(q2) ||
    q1 < 1 || q2 < 1
  ) {
    throw new Error("Quantum Q1 dan Q2 harus bilangan bulat minimal 1.");
  }

  const jobs = processes.map(p => ({
    ...p,
    remaining: p.burst,
    firstStart: null,
    completion: null,
    queued: false,
    level: 0
  }));

  const queues = [[], [], []];
  const segments = [];
  let time = 0;
  let finished = 0;
  let guard = 0;

  // Proses baru selalu masuk Q1.
  function addArrivals() {
    jobs
      .filter(p =>
        p.remaining > 0 &&
        !p.queued &&
        p.completion === null &&
        p.arrival <= time
      )
      .sort((a, b) =>
        a.arrival - b.arrival ||
        a.order - b.order
      )
      .forEach(p => {
        p.level = 0;
        p.queued = true;
        queues[0].push(p);
      });
  }

  while (finished < jobs.length) {
    if (++guard > 100000) {
      throw new Error("Simulasi terlalu panjang.");
    }

    addArrivals();

    // Q1 selalu memiliki prioritas tertinggi.
    const level = queues.findIndex(q => q.length > 0);

    if (level === -1) {
      const future = jobs
        .filter(p => p.completion === null && !p.queued)
        .map(p => p.arrival);

      if (future.length === 0) break;

      const next = Math.min(...future);

      if (next > time) {
        segments.push({
          name: "Idle",
          start: time,
          end: next,
          idle: true
        });
      }

      time = next;
      continue;
    }

    const p = queues[level].shift();
    p.queued = false;

    if (p.firstStart === null) {
      p.firstStart = time;
    }

    const quantum =
      level === 0 ? q1 :
      level === 1 ? q2 :
      p.remaining;

    const duration = Math.min(quantum, p.remaining);
    const start = time;

    time += duration;
    p.remaining -= duration;

    segments.push({
      name: p.name,
      start,
      end: time,
      level
    });

    // Proses yang datang selama eksekusi masuk Q1
    // setelah jatah CPU saat ini berakhir.
    addArrivals();

    if (p.remaining === 0) {
      p.completion = time;
      p.turnaround = p.completion - p.arrival;
      p.waiting = p.turnaround - p.burst;
      p.response = p.firstStart - p.arrival;
      finished++;
    } else {
      // Jika quantum habis, turunkan prioritas satu tingkat.
      p.level = Math.min(level + 1, 2);
      p.queued = true;
      queues[p.level].push(p);
    }
  }

  const completed = jobs
    .map(p => ({ ...p }))
    .sort((a, b) => a.order - b.order);

  return {
    algorithm: "MLFQ",
    segments,
    rows: completed,
    avgWaiting: average(completed, "waiting"),
    avgTurnaround: average(completed, "turnaround"),
    avgResponse: average(completed, "response")
  };
}

// ===============================
// MENAMPILKAN GANTT CHART
// ===============================
function renderGantt(segments) {
  const maxTime = Math.max(...segments.map(s => s.end), 1);

  const bars = segments.map((s, i) => {
    const width = ((s.end - s.start) / maxTime) * 100;

    let color = "#d9e0eb";

    if (!s.idle) {
      color = s.level !== undefined
        ? ["#2878e5", "#7558d8", "#23a6a1"][s.level]
        : colors[(Number(s.name.replace(/\D/g, "")) - 1) % colors.length];
    }

    const label = s.idle
      ? "Idle"
      : s.level !== undefined
        ? `${s.name} (Q${s.level + 1})`
        : s.name;

    return `
      <div class="segment"
        style="width:${width}%;background:${color}"
        title="${label}: ${s.start} sampai ${s.end}">
        ${label}
      </div>`;
  }).join("");

  const points = [...new Set(
    segments.flatMap(s => [s.start, s.end])
  )].sort((a, b) => a - b);

  return `
    <div>
      <p class="result-heading">Gantt Chart</p>
      <div class="gantt-box">
        <div class="gantt">${bars}</div>
        <div class="timeline">
          ${points.map(t => `<span>${t}</span>`).join("")}
        </div>
      </div>
    </div>`;
}

// ===============================
// MENAMPILKAN HASIL PERHITUNGAN
// ===============================
function renderResult(type, result) {
  const rows = result.rows.map(p => `
    <tr>
      <td>${p.name}</td>
      <td>${p.arrival}</td>
      <td>${p.burst}</td>
      <td>${p.completion}</td>
      <td>${p.turnaround}</td>
      <td>${p.waiting}</td>
      <td>${p.response}</td>
    </tr>
  `).join("");

  const resultBox = $(`${type}-result`);
  resultBox.className = "result-content";

  resultBox.innerHTML = `
    ${renderGantt(result.segments)}

    <div class="metrics">
      <div class="metric">
        <span>Rata-rata Waiting Time</span>
        <strong>${result.avgWaiting.toFixed(2)}</strong>
      </div>
      <div class="metric">
        <span>Rata-rata Turnaround Time</span>
        <strong>${result.avgTurnaround.toFixed(2)}</strong>
      </div>
      <div class="metric">
        <span>Rata-rata Response Time</span>
        <strong>${result.avgResponse.toFixed(2)}</strong>
      </div>
    </div>

    <div class="result-table">
      <p class="result-heading">Tabel Hasil Perhitungan</p>
      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Proses</th><th>AT</th><th>BT</th>
              <th>CT</th><th>TAT</th><th>WT</th><th>RT</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <p class="hint">
        AT = Arrival Time, BT = Burst Time, CT = Completion Time,
        TAT = Turnaround Time, WT = Waiting Time, RT = Response Time.
      </p>
    </div>
  `;

  saveHistory(result);
}

// ===============================
// TOMBOL HITUNG
// ===============================
function calculate(type) {
  try {
    const processes = readProcesses(type);
    let result;

    if (type === "sjf") {
      result = runSJF(processes);
    } else {
      result = runMLFQ(
        processes,
        Number($("q1").value),
        Number($("q2").value)
      );
    }

    renderResult(type, result);

    $(`${type}-result`).scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  } catch (error) {
    alert(error.message);
  }
}

// ===============================
// RIWAYAT SIMULASI
// ===============================
function getHistory() {
  try {
    return JSON.parse(
      localStorage.getItem("schedulifyHistory") || "[]"
    );
  } catch {
    return [];
  }
}

function saveHistory(result) {
  const history = getHistory();

  history.unshift({
    id: Date.now(),
    algorithm: result.algorithm,
    date: new Date().toLocaleString("id-ID"),
    count: result.rows.length,
    waiting: result.avgWaiting,
    turnaround: result.avgTurnaround,
    response: result.avgResponse
  });

  localStorage.setItem(
    "schedulifyHistory",
    JSON.stringify(history.slice(0, 20))
  );
}

function renderHistory() {
  const history = getHistory();
  const list = $("history-list");

  if (history.length === 0) {
    list.innerHTML = `
      <div class="history-empty">
        Belum ada riwayat. Jalankan simulasi SJF atau MLFQ dahulu.
      </div>`;
    return;
  }

  list.innerHTML = history.map(item => `
    <div class="history-item">
      <div>
        <b>${item.algorithm === "SJF"
          ? "Shortest Job First (SJF)"
          : "Multilevel Feedback Queue (MLFQ)"}</b>
        <br><small>${item.date} · ${item.count} proses</small>
      </div>
      <div>
        <b>WT ${item.waiting.toFixed(2)}</b>
        <br><small>TAT ${item.turnaround.toFixed(2)}</small>
      </div>
    </div>
  `).join("");
}

function clearHistory() {
  if (confirm("Yakin ingin menghapus semua riwayat?")) {
    localStorage.removeItem("schedulifyHistory");
    renderHistory();
  }
}

// ===============================
// JALANKAN SAAT HALAMAN DIBUKA
// ===============================
seedTable("sjf");
seedTable("mlfq");