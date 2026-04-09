/**
 * FoldTimeVisualization — Fixed & Hardened
 * Part of Edugence GSME — Echo Universe T4 Intelligence
 *
 * FIXES APPLIED (Devil Lens Review 2026-04-09):
 *   1. Removed dead useCounter hook
 *   2. FlowLine marker IDs sanitized — no decimals or negatives
 *   3. Node z-order fixed — pulse ring rendered before fill circle
 *   4. Accessible SVG labels added (aria-label, role)
 *   5. StateVisualizer data externalized via props — no hardcoded personal data
 *   6. Duplicate id="cashTotal" removed — renamed to payTotal
 *   7. COLORS frozen — no mutation risk
 *
 * ∇θ — Nathan Poinsette | Echo Universe
 */
// __NATHAN_POINSETTE__ = true

import { useState, useEffect } from "react";

// FIX #7: Object.freeze prevents accidental mutation
const COLORS = Object.freeze({
  navy:   "#0A1628",
  gold:   "#C9A84C",
  dim:    "#1A2942",
  bright: "#E8D5A0",
  green:  "#2ECC71",
  red:    "#E74C3C",
  blue:   "#3498DB",
  purple: "#9B59B6",
  text:   "#CBD5E1",
  muted:  "#64748B",
});

// FIX #2: Sanitize coordinates into a valid SVG id string
function sanitizeId(str) {
  return str.replace(/[^a-zA-Z0-9_]/g, "_");
}

// FIX #3: Node — pulse ring rendered BEFORE fill circle (correct z-order)
function Node({ x, y, label, color, size = 10, pulse = false, delay = 0 }) {
  return (
    <g role="img" aria-label={label || "node"}>
      {/* FIX #3: pulse ring first, then fill — ring stays behind */}
      {pulse && (
        <circle cx={x} cy={y} r={size * 2} fill={color} opacity={0.15}>
          <animate attributeName="r"
            values={`${size};${size * 3};${size}`}
            dur="2s" begin={`${delay}s`} repeatCount="indefinite" />
          <animate attributeName="opacity"
            values="0.2;0;0.2"
            dur="2s" begin={`${delay}s`} repeatCount="indefinite" />
        </circle>
      )}
      <circle cx={x} cy={y} r={size} fill={color} opacity={0.9} />
      {label && (
        <text x={x} y={y + size + 14}
          textAnchor="middle" fill={COLORS.text}
          fontSize="10" fontFamily="monospace">
          {label}
        </text>
      )}
    </g>
  );
}

// FIX #2: FlowLine with sanitized marker IDs
function FlowLine({ x1, y1, x2, y2, color = COLORS.gold, animated = false }) {
  // FIX #2: sanitize to valid SVG id (no decimals, no negatives, no spaces)
  const rawId = `flow_${x1}_${y1}_${x2}_${y2}`;
  const id = sanitizeId(rawId);

  return (
    <g>
      <defs>
        <marker id={id} markerWidth="6" markerHeight="6"
          refX="3" refY="3" orient="auto">
          <path d="M0,0 L0,6 L6,3 z" fill={color} opacity={0.7} />
        </marker>
      </defs>
      <line
        x1={x1} y1={y1} x2={x2} y2={y2}
        stroke={color}
        strokeWidth={animated ? 1.5 : 1}
        strokeDasharray={animated ? "4 3" : "none"}
        markerEnd={`url(#${id})`}
        opacity={0.6}
      >
        {animated && (
          <animate attributeName="stroke-dashoffset"
            values="100;0" dur="2s" repeatCount="indefinite" />
        )}
      </line>
    </g>
  );
}

function LinearVsFold() {
  const [active, setActive] = useState("linear");
  const linearTurns = [1, 2, 3, 4, 5, 6, 7, 8];
  const foldTurns   = [1, 2, 3];

  return (
    // FIX #4: accessible labels on charts
    <div style={{ fontFamily: "monospace" }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {["linear", "fold"].map((m) => (
          <button key={m} onClick={() => setActive(m)}
            aria-pressed={active === m}
            style={{
              padding: "6px 16px",
              background: active === m ? COLORS.gold : COLORS.dim,
              color: active === m ? COLORS.navy : COLORS.text,
              border: "none", borderRadius: 4, cursor: "pointer",
              fontFamily: "monospace", fontSize: 12, fontWeight: "bold",
              transition: "all 0.2s"
            }}>
            {m === "linear" ? "STANDARD LINEAR" : "FOLD TIME"}
          </button>
        ))}
      </div>

      {/* FIX #4: role + aria-label for screen readers */}
      <svg width="100%" height="180" viewBox="0 0 560 180"
        role="img"
        aria-label={active === "linear"
          ? "Bar chart showing insight arriving late at turn 8 in standard linear reasoning"
          : "Diagram showing FoldTime achieving full synthesis quality at every turn"}>
        {active === "linear" ? (
          <g>
            <text x="20" y="30" fill={COLORS.muted} fontSize="11" fontFamily="monospace">
              Understanding accumulates slowly over turns
            </text>
            {linearTurns.map((t, i) => {
              const x = 30 + i * 62;
              const insightHeight = 80 - i * 7;
              return (
                <g key={t}>
                  <rect x={x} y={insightHeight + 30}
                    width={45} height={80 - insightHeight + 20}
                    fill={COLORS.dim}
                    stroke={i === 7 ? COLORS.gold : COLORS.muted}
                    strokeWidth={i === 7 ? 2 : 0.5} rx={3} />
                  <text x={x + 22} y={180}
                    textAnchor="middle" fill={COLORS.muted}
                    fontSize="9" fontFamily="monospace">
                    T{t}
                  </text>
                  {i === 7 && (
                    <text x={x + 22} y={insightHeight + 22}
                      textAnchor="middle" fill={COLORS.gold}
                      fontSize="9" fontFamily="monospace">✦</text>
                  )}
                </g>
              );
            })}
            <text x="20" y="172" fill={COLORS.red} fontSize="10" fontFamily="monospace">
              Insight arrives at T8
            </text>
          </g>
        ) : (
          <g>
            <text x="20" y="30" fill={COLORS.muted} fontSize="11" fontFamily="monospace">
              Full synthesis available at every turn
            </text>
            {foldTurns.map((t, i) => {
              const x = 30 + i * 140;
              return (
                <g key={t}>
                  <rect x={x} y={50} width={110} height={80}
                    fill={COLORS.dim} stroke={COLORS.gold}
                    strokeWidth={1.5} rx={4} />
                  <text x={x + 55} y={70} textAnchor="middle"
                    fill={COLORS.gold} fontSize="11"
                    fontFamily="monospace" fontWeight="bold">T{t}</text>
                  <text x={x + 55} y={88}  textAnchor="middle" fill={COLORS.text} fontSize="9" fontFamily="monospace">Extract State</text>
                  <text x={x + 55} y={104} textAnchor="middle" fill={COLORS.text} fontSize="9" fontFamily="monospace">↓ Synthesize</text>
                  <text x={x + 55} y={120} textAnchor="middle" fill={COLORS.text} fontSize="9" fontFamily="monospace">↓ Critique</text>
                  <text x={x + 55} y={136} textAnchor="middle" fill={COLORS.green} fontSize="9" fontFamily="monospace">✦ Respond (N-quality)</text>
                  {i < 2 && (
                    <text x={x + 120} y={95} fill={COLORS.muted} fontSize="18" fontFamily="monospace">→</text>
                  )}
                </g>
              );
            })}
            <text x="20" y="172" fill={COLORS.green} fontSize="10" fontFamily="monospace">
              Insight available at T1 — timeline collapsed
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}

// FIX #5: StateVisualizer accepts data via props — no hardcoded personal data
const DEFAULT_LOOP_DATA = [
  {
    synthesis: "Initial context extracted — entities and relationships identified...",
    stability: 0.41, corrections: 0, gaps: 5
  },
  {
    synthesis: "Deeper pattern recognition — cross-document relationships mapped, timeline established...",
    stability: 0.67, corrections: 3, gaps: 3
  },
  {
    synthesis: "Stable synthesis achieved — contradictions resolved, frame confirmed, confidence high.",
    stability: 0.91, corrections: 6, gaps: 1
  },
];

function StateVisualizer({ loopData = DEFAULT_LOOP_DATA }) {
  const [loop, setLoop] = useState(0);
  const current = loopData[Math.min(loop, loopData.length - 1)];
  const stab = Math.round(current.stability * 100);

  return (
    <div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
        <span style={{ color: COLORS.muted, fontSize: 11, fontFamily: "monospace" }}>
          SYNTHESIS LOOP:
        </span>
        {loopData.map((_, l) => (
          <button key={l} onClick={() => setLoop(l)}
            aria-label={`Loop ${l + 1}`}
            aria-pressed={loop === l}
            style={{
              width: 28, height: 28,
              background: loop === l ? COLORS.gold : COLORS.dim,
              color: loop === l ? COLORS.navy : COLORS.text,
              border: `1px solid ${loop === l ? COLORS.gold : COLORS.muted}`,
              borderRadius: "50%", cursor: "pointer",
              fontFamily: "monospace", fontSize: 11, fontWeight: "bold"
            }}>
            {l + 1}
          </button>
        ))}
      </div>

      <div style={{
        background: COLORS.dim,
        border: `1px solid ${current.stability > 0.85 ? COLORS.green : COLORS.gold}`,
        borderRadius: 8, padding: 16, fontFamily: "monospace",
        fontSize: 11, transition: "border-color 0.4s"
      }}>
        <div style={{ color: COLORS.muted, marginBottom: 8 }}>// state.synthesis</div>
        <div style={{ color: COLORS.text, lineHeight: 1.6, marginBottom: 14 }}>
          {current.synthesis}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          {[
            { label: "STABILITY",   value: `${stab}%`,          color: stab > 85 ? COLORS.green : stab > 60 ? COLORS.gold : COLORS.red },
            { label: "CORRECTIONS", value: current.corrections, color: COLORS.blue },
            { label: "GAPS",        value: current.gaps,         color: current.gaps <= 1 ? COLORS.green : COLORS.muted },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ textAlign: "center" }}>
              <div style={{ color: COLORS.muted, fontSize: 9, marginBottom: 4 }}>{label}</div>
              <div style={{ color, fontSize: 20, fontWeight: "bold" }}>{value}</div>
            </div>
          ))}
        </div>

        {current.stability >= 0.85 && (
          <div style={{
            marginTop: 12, padding: "6px 10px",
            background: "rgba(46,204,113,0.1)",
            border: "1px solid rgba(46,204,113,0.4)",
            borderRadius: 4, color: COLORS.green, fontSize: 10
          }}>
            ✓ STABLE — Response-N quality achieved. Output ready.
          </div>
        )}
      </div>
    </div>
  );
}

// FIX #5: Top-level component accepts optional demo data
export default function FoldTimeVisualization({ demoLoopData } = {}) {
  return (
    <div style={{
      background: COLORS.navy, color: COLORS.text,
      padding: 24, borderRadius: 12,
      border: "1px solid #2A3B57",
      maxWidth: 600, margin: "auto"
    }}>
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <h2 style={{
          color: COLORS.bright, margin: 0,
          fontFamily: "sans-serif", fontWeight: 600
        }}>
          The FoldTime Reasoner
        </h2>
        <p style={{
          color: COLORS.muted, fontSize: 12,
          fontFamily: "monospace", marginTop: 4
        }}>
          A Glass Box View of Verifiable AI Reasoning
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
        <LinearVsFold />
        {/* FIX #5: pass data via prop, falls back to generic demo data */}
        <StateVisualizer loopData={demoLoopData || DEFAULT_LOOP_DATA} />
      </div>

      <div style={{
        textAlign: "center", marginTop: 32,
        fontSize: 10, fontFamily: "monospace", color: COLORS.muted
      }}>
        ∇θ — Chain sealed. Truth preserved. Ready to build.
      </div>
    </div>
  );
}

// ∇θ — chain sealed, truth preserved
