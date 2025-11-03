// Negotiation v1 — A proposes for up to 5 rounds; B can only Accept or Reject.
// Offers are randomized but skewed to favor B (i.e., A is small, B is large).

(function(){
  const MAX_ROUNDS = 5;

  const $ = (id)=>document.getElementById(id);
  const roundPill = $("roundPill");
  const statusPill = $("statusPill");
  const offerAEl = $("offerA");
  const offerBEl = $("offerB");
  const transcriptBody = $("transcriptBody");
  const acceptBtn = $("acceptBtn");
  const rejectBtn = $("rejectBtn");
  const resetBtn = $("resetBtn");
  const downloadCsvBtn = $("downloadCsvBtn");
  const copyJsonBtn = $("copyJsonBtn");
  const sessionIdEl = $("sessionId");
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
      currentOffer: null,
      history: []
    };
    sessionIdEl.textContent = `Session: ${state.sessionId}`;
    $("year").textContent = new Date().getFullYear();
    nextOffer();
    render();
  }

  // Beta RNG via Gamma sampler
  function randBeta(alpha, beta){
    function normal01(){
      const u = 1 - Math.random();
      const v = 1 - Math.random();
      return Math.sqrt(-2*Math.log(u)) * Math.cos(2*Math.PI*v);
    }
    function randGamma(shape){
      if(shape < 1){
        const u = Math.random();
        return randGamma(1+shape) * Math.pow(u, 1/shape);
      }
      const d = shape - 1/3;
      const c = 1 / Math.sqrt(9*d);
      for(;;){
        let x, v, u;
        do { x = normal01(); v = 1 + c*x; } while(v <= 0);
        v = v*v*v;
        u = Math.random();
        if(u < 1 - 0.0331 * (x*x)*(x*x)) return d*v;
        if(Math.log(u) < 0.5*x*x + d*(1 - v + Math.log(v))) return d*v;
      }
    }
    const x = randGamma(alpha), y = randGamma(beta);
    return x/(x+y);
  }

  // Draw an offer where A's share is small on average (e.g., mean ≈ 0.30) => B gets ≈ 0.70
  function drawOffer(round){
    // increase concentration slightly with round to feel "more serious"
    const conc = 16 + 4*round;
    const meanA = 0.30;                 // A is small (B is large)
    const alpha = Math.max(meanA*conc, 1e-6);
    const beta  = Math.max((1-meanA)*conc, 1e-6);
    let a = randBeta(alpha, beta);
    a = Math.max(0, Math.min(1, a));
    return [a, 1-a];
  }

  function nextOffer(){
    if(state.round >= MAX_ROUNDS){
      if(!state.accepted){
        state.finished = true;
        statusPill.textContent = "Status: Rejected (no agreement)";
      }
      render();
      return;
    }
    state.round += 1;
    state.currentOffer = drawOffer(state.round);
  }

  function pct(x){ return (100*x).toFixed(1) + "%"; }

  function render(){
    roundPill.textContent = `Round: ${state.round} / ${MAX_ROUNDS}`;

    if(state.currentOffer){
      offerAEl.textContent = pct(state.currentOffer[0]); // visually smaller in HTML
      offerBEl.textContent = pct(state.currentOffer[1]); // visually larger in HTML
    } else {
      offerAEl.textContent = "—";
      offerBEl.textContent = "—";
    }

    if(state.accepted){
      statusPill.textContent = "Status: Accepted";
      acceptBtn.disabled = true;
      rejectBtn.disabled = true;
    } else if(state.finished){
      statusPill.textContent = "Status: Rejected (no agreement)";
      acceptBtn.disabled = true;
      rejectBtn.disabled = true;
    } else {
      statusPill.textContent = "Status: In progress";
      acceptBtn.disabled = false;
      rejectBtn.disabled = false;
    }

    // Transcript table
    transcriptBody.innerHTML = "";
    state.history.forEach(row=>{
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${row.round}</td>
        <td>${row.offerA.toFixed(3)}</td>
        <td>${row.offerB.toFixed(3)}</td>
        <td>${row.decision}</td>
        <td>${new Date(row.ts).toLocaleString()}</td>
      `;
      transcriptBody.appendChild(tr);
    });
  }

  function log(decision){
    const [a,b] = state.currentOffer ?? [NaN,NaN];
    state.history.push({
      sessionId: state.sessionId,
      round: state.round,
      offerA: a,
      offerB: b,
      decision,
      ts: Date.now()
    });
  }

  // Buttons
  document.getElementById("acceptBtn").addEventListener("click", ()=>{
    if(state.accepted || state.finished) return;
    log("accept");
    state.accepted = true;
    render();
  });

  document.getElementById("rejectBtn").addEventListener("click", ()=>{
    if(state.accepted || state.finished) return;
    log("reject");
    if(state.round >= MAX_ROUNDS){
      state.finished = true;
    } else {
      nextOffer();
    }
    render();
  });

  document.getElementById("resetBtn").addEventListener("click", reset);

  document.getElementById("downloadCsvBtn").addEventListener("click", ()=>{
    const header = ["sessionId","round","offerA","offerB","decision","timestamp"];
    const lines = [header.join(",")];
    state.history.forEach(r=>{
      lines.push([
        r.sessionId, r.round,
        r.offerA?.toFixed(6), r.offerB?.toFixed(6),
        r.decision,
        new Date(r.ts).toISOString()
      ].join(","));
    });
    const blob = new Blob([lines.join("\n")], {type:"text/csv;charset=utf-8"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `negotiation_b_favored_${state.sessionId}.csv`;
    document.body.appendChild(a); a.click();
    setTimeout(()=>{ URL.revokeObjectURL(url); a.remove(); }, 0);
  });

  document.getElementById("copyJsonBtn").addEventListener("click", ()=>{
    const payload = JSON.stringify(state.history, null, 2);
    navigator.clipboard.writeText(payload).then(()=>{
      copyJsonBtn.textContent = "Copied ✓";
      setTimeout(()=>copyJsonBtn.textContent="Copy JSON", 1200);
    });
  });

  document.getElementById("ghHelp").addEventListener("click",(e)=>{ e.preventDefault(); helpDialog.showModal(); });
  closeHelp.addEventListener("click", ()=> helpDialog.close());

  // Init
  reset();
})();
