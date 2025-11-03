// Two-Person Negotiation — 5 rounds, Accept/Reject, optional counteroffer, transcript download
// Vanilla JS, no dependencies

(function(){
  const MAX_ROUNDS = 5;
  const PROPOSER_BIAS = 0.08; // A on 1,3,5; B on 2,4

  const $ = (id)=>document.getElementById(id);
  const roundPill = $("roundPill");
  const proposerPill = $("proposerPill");
  const statusPill = $("statusPill");
  const offerAEl = $("offerA");
  const offerBEl = $("offerB");
  const transcriptBody = $("transcriptBody");
  const acceptBtn = $("acceptBtn");
  const rejectBtn = $("rejectBtn");
  const resetBtn = $("resetBtn");
  const counterBtn = $("counterBtn");
  const counterInput = $("counterInput");
  const downloadCsvBtn = $("downloadCsvBtn");
  const copyJsonBtn = $("copyJsonBtn");
  const sessionIdEl = $("sessionId");
  const ghHelp = $("ghHelp");
  const helpDialog = $("helpDialog");
  const closeHelp = $("closeHelp");

  let state;

  function newSessionId(){
    const d = new Date();
    return d.toISOString().replace(/[-:.TZ]/g,"").slice(0,14); // yyyyMMddHHmmss
  }

  function reset(){
    state = {
      sessionId: newSessionId(),
      round: 0,
      accepted: false,
      finished: false,
      currentProposer: null,
      currentOffer: null,
      history: []
    };
    sessionIdEl.textContent = `Session: ${state.sessionId}`;
    sessionIdEl.classList.add("pill");
    $("year").textContent = new Date().getFullYear();
    nextOffer();
    render();
  }

  function randBeta(alpha, beta){
    // Marsaglia simple: use Gamma draws
    function randGamma(shape){
      // Best-effort simple sampler for shape>0
      if(shape < 1){
        const u = Math.random();
        return randGamma(1+shape) * Math.pow(u, 1/shape);
      }
      const d = shape - 1/3;
      const c = 1 / Math.sqrt(9*d);
      for(;;){
        let x, v, u;
        do {
          x = normal01();
          v = 1 + c*x;
        } while(v <= 0);
        v = v*v*v;
        u = Math.random();
        if(u < 1 - 0.0331 * (x*x)*(x*x)) return d*v;
        if(Math.log(u) < 0.5*x*x + d*(1 - v + Math.log(v))) return d*v;
      }
    }
    function normal01(){
      // Box-Muller
      const u = 1 - Math.random();
      const v = 1 - Math.random();
      return Math.sqrt(-2*Math.log(u)) * Math.cos(2*Math.PI*v);
    }
    const x = randGamma(alpha);
    const y = randGamma(beta);
    return x/(x+y);
  }

  function drawOffer(round, proposer){
    const conc = 14 + 6*round;
    const center = 0.5 + (proposer === "A" ? PROPOSER_BIAS : -PROPOSER_BIAS);
    const alpha = Math.max(center*conc, 1e-6);
    const beta = Math.max((1-center)*conc, 1e-6);
    let a = randBeta(alpha, beta);
    a = Math.max(0, Math.min(1, a));
    return [a, 1-a];
  }

  function nextOffer(){
    if(state.round >= MAX_ROUNDS){
      // Hard reject if not already accepted
      if(!state.accepted){
        state.finished = true;
        statusPill.textContent = "Status: Rejected (no agreement)";
      }
      render();
      return;
    }
    state.round += 1;
    state.currentProposer = (state.round % 2 === 1) ? "A" : "B";
    state.currentOffer = drawOffer(state.round, state.currentProposer);
  }

  function pct(x){ return (100*x).toFixed(1) + "%"; }

  function render(){
    roundPill.textContent = `Round: ${state.round} / ${MAX_ROUNDS}`;
    proposerPill.textContent = `Proposer: ${state.currentProposer ?? "—"}`;

    if(state.currentOffer){
      offerAEl.textContent = pct(state.currentOffer[0]);
      offerBEl.textContent = pct(state.currentOffer[1]);
    } else {
      offerAEl.textContent = "—";
      offerBEl.textContent = "—";
    }

    if(state.accepted){
      statusPill.textContent = "Status: Accepted";
      acceptBtn.disabled = true;
      rejectBtn.disabled = true;
      counterBtn.disabled = true;
      counterInput.disabled = true;
    } else if(state.finished){
      statusPill.textContent = "Status: Rejected (no agreement)";
      acceptBtn.disabled = true;
      rejectBtn.disabled = true;
      counterBtn.disabled = true;
      counterInput.disabled = true;
    } else {
      statusPill.textContent = "Status: In progress";
      acceptBtn.disabled = false;
      rejectBtn.disabled = false;
      counterBtn.disabled = false;
      counterInput.disabled = false;
    }

    // Transcript
    transcriptBody.innerHTML = "";
    state.history.forEach(row=>{
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${row.round}</td>
        <td>${row.proposer}</td>
        <td>${row.offerA.toFixed(3)}</td>
        <td>${row.offerB.toFixed(3)}</td>
        <td>${row.decision}</td>
        <td>${row.counterA !== null ? row.counterA.toFixed(3) : ""}</td>
        <td>${new Date(row.ts).toLocaleString()}</td>
      `;
      transcriptBody.appendChild(tr);
    });
  }

  function log(decision, counterA=null){
    const [a,b] = state.currentOffer ?? [NaN,NaN];
    state.history.push({
      sessionId: state.sessionId,
      round: state.round,
      proposer: state.currentProposer,
      offerA: a,
      offerB: b,
      decision,
      counterA,
      ts: Date.now()
    });
  }

  acceptBtn.addEventListener("click", ()=>{
    if(state.accepted || state.finished) return;
    log("accept", null);
    state.accepted = true;
    render();
  });

  rejectBtn.addEventListener("click", ()=>{
    if(state.accepted || state.finished) return;
    log("reject", null);
    // If we’re on round 5, rejecting ends the session as Rejected
    if(state.round >= MAX_ROUNDS){
      state.finished = true;
    } else {
      nextOffer();
    }
    render();
  });

  counterBtn.addEventListener("click", ()=>{
    if(state.accepted || state.finished) return;
    const val = parseFloat(counterInput.value);
    let counter = Number.isFinite(val) ? Math.max(0, Math.min(1, val)) : null;
    log("counter", counter);
    // Move to next round after recording counter
    if(state.round >= MAX_ROUNDS){
      state.finished = true;
    } else {
      nextOffer();
    }
    render();
  });

  resetBtn.addEventListener("click", reset);

  downloadCsvBtn.addEventListener("click", ()=>{
    const header = ["sessionId","round","proposer","offerA","offerB","decision","counterA","timestamp"];
    const lines = [header.join(",")];
    state.history.forEach(r=>{
      lines.push([
        r.sessionId, r.round, r.proposer,
        r.offerA?.toFixed(6), r.offerB?.toFixed(6),
        r.decision,
        (r.counterA==null?"":r.counterA.toFixed(6)),
        new Date(r.ts).toISOString()
      ].join(","));
    });
    const blob = new Blob([lines.join("\n")], {type:"text/csv;charset=utf-8"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `negotiation_${state.sessionId}.csv`;
    document.body.appendChild(a); a.click();
    setTimeout(()=>{ URL.revokeObjectURL(url); a.remove(); }, 0);
  });

  copyJsonBtn.addEventListener("click", ()=>{
    const payload = JSON.stringify(state.history, null, 2);
    navigator.clipboard.writeText(payload).then(()=>{
      copyJsonBtn.textContent = "Copied ✓";
      setTimeout(()=>copyJsonBtn.textContent="Copy JSON", 1200);
    });
  });

  ghHelp.addEventListener("click",(e)=>{ e.preventDefault(); helpDialog.showModal(); });
  closeHelp.addEventListener("click", ()=> helpDialog.close());

  // Init
  reset();
})();
