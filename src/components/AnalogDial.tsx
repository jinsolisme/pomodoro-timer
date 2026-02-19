import { useEffect, useRef } from 'react';
import { useDialDrag } from '../hooks/useDialDrag';
import type { TimerState } from '../hooks/useTimer';
import './AnalogDial.css';

const SIZE = 340;
const CENTER = SIZE / 2;

// Radii
const OUTER_R = 166;       // outer bezel edge
const SECTOR_R = 96;       // red filled sector radius (further reduced to avoid header overlap)
const TICK_OUT = 162;      // tick mark outer end
const TICK_IN_MAJ = 144;   // major tick (5-min) inner end
const TICK_IN_MED = 150;   // medium tick inner end
const TICK_IN_MIN = 155;   // minor tick inner end
const KNOB_R = 34;         // metallic dome (enlarged)
const POINTER_W = 6.2;
const POINTER_PROTRUSION = 12; // makes pointer clearly visible above knob at top
const POINTER_H = KNOB_R * 2.1;

const MAX_DIAL_SECONDS = 60 * 60;

/** Filled pie sector from 12 o'clock clockwise */
function Sector({ angleDeg }: { angleDeg: number }) {
  if (angleDeg <= 0) return null;
  const a = Math.min(angleDeg, 359.99);
  const rad = (a - 90) * (Math.PI / 180);
  const ex = CENTER + SECTOR_R * Math.cos(rad);
  const ey = CENTER + SECTOR_R * Math.sin(rad);
  const largeArc = a > 180 ? 1 : 0;
  return (
    <path
      className="dial-sector"
      d={`M${CENTER},${CENTER} L${CENTER},${CENTER - SECTOR_R} A${SECTOR_R},${SECTOR_R} 0 ${largeArc},1 ${ex},${ey}Z`}
    />
  );
}

function getTicks() {
  const ticks = [];
  for (let i = 0; i < 60; i++) {
    const angle = (i / 60) * 360 - 90;
    const rad = angle * (Math.PI / 180);
    const isMajor = i % 5 === 0;         // every 5 min
    const isMedium = i % 5 === 0;        // same as major for now
    const inner = isMajor ? TICK_IN_MAJ : i % 2 === 0 ? TICK_IN_MED : TICK_IN_MIN;
    // Label info
    const labelMin = isMajor ? i : null;
    const isLargeLabel = labelMin !== null && labelMin % 10 === 0;
    const isSmallLabel = labelMin !== null && labelMin % 10 !== 0;
    ticks.push({
      x1: CENTER + TICK_OUT * Math.cos(rad),
      y1: CENTER + TICK_OUT * Math.sin(rad),
      x2: CENTER + inner * Math.cos(rad),
      y2: CENTER + inner * Math.sin(rad),
      isMajor,
      isMedium,
      labelMin,
      isLargeLabel,
      isSmallLabel,
      angle,
    });
  }
  return ticks;
}

// Radius for number labels — large numbers slightly further in
const LABEL_R_LARGE = 122;
const LABEL_R_SMALL = 126;

interface AnalogDialProps {
  remainingSeconds: number;
  totalSeconds: number;
  timerState: TimerState;
  onDragEnd: (minutes: number) => void;
  onDragPreview?: (payload: { isDragging: boolean; minutes: number }) => void;
}

export function AnalogDial({
  remainingSeconds,
  totalSeconds,
  timerState,
  onDragEnd,
  onDragPreview,
}: AnalogDialProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const { isDragging, dragMinutes, angleDeg: dragAngleDeg } = useDialDrag({ svgRef, onDragEnd });

  useEffect(() => {
    if (!onDragPreview) return;
    onDragPreview({
      isDragging,
      minutes: isDragging ? dragMinutes : 0,
    });
  }, [isDragging, dragMinutes, onDragPreview]);

  const clampedRemaining = Math.max(0, Math.min(MAX_DIAL_SECONDS, remainingSeconds));
  const countdownAngle =
    (timerState === 'running' || timerState === 'done') && totalSeconds > 0
      ? (clampedRemaining / MAX_DIAL_SECONDS) * 360
      : 0;
  const arcAngle = isDragging
    ? dragAngleDeg
    : timerState === 'running' || timerState === 'done'
      ? countdownAngle
      : 0;

  const isInteractive = timerState !== 'done';
  const ticks = getTicks();

  return (
    <svg
      ref={svgRef}
      width={SIZE}
      height={SIZE}
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      className={`dial-svg${isInteractive ? '' : ' is-locked'}`}
      aria-label="Pomodoro dial timer"
    >
      <defs>
        {/* Metallic knob */}
        <radialGradient id="knob-metal" cx="40%" cy="32%" r="62%">
          <stop offset="0%"   stopColor="#f2f2f0" />
          <stop offset="30%"  stopColor="#d2d2d0" />
          <stop offset="65%"  stopColor="#a8a8a6" />
          <stop offset="100%" stopColor="#787876" />
        </radialGradient>
        <radialGradient id="knob-shine" cx="36%" cy="26%" r="44%">
          <stop offset="0%"   stopColor="rgba(255,255,255,0.75)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </radialGradient>
      </defs>

      {/* Dial face — white */}
      <circle className="dial-face" cx={CENTER} cy={CENTER} r={OUTER_R} />

      {/* Red filled sector */}
      <Sector angleDeg={arcAngle} />

      {/* Tick marks (on top of sector) */}
      {ticks.map((tick, i) => (
        <line
          key={i}
          className={tick.isMajor ? 'dial-tick dial-tick-major' : 'dial-tick dial-tick-minor'}
          x1={tick.x1} y1={tick.y1}
          x2={tick.x2} y2={tick.y2}
          strokeLinecap="round"
        />
      ))}

      {/* Minute labels — alternating large bold / small italic */}
      {ticks
        .filter((t) => t.labelMin !== null)
        .map((tick, i) => {
          const rad = tick.angle * (Math.PI / 180);
          const r = tick.isLargeLabel ? LABEL_R_LARGE : LABEL_R_SMALL;
          const lx = CENTER + r * Math.cos(rad);
          const ly = CENTER + r * Math.sin(rad);

          if (tick.isLargeLabel) {
            return (
              <text
                key={i}
                x={lx} y={ly}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize="32"
                fontFamily='"Helvetica Neue Condensed Bold", "HelveticaNeue-CondensedBold", "Helvetica Neue", Helvetica, Arial, sans-serif'
                fontWeight="700"
                fontStyle="normal"
                fill="#1a1a1a"
                style={{ userSelect: 'none', pointerEvents: 'none' }}
              >
                {tick.labelMin}
              </text>
            );
          } else {
            return (
              <text
                key={i}
                x={lx} y={ly}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize="16"
                fontFamily='"Helvetica Neue", Helvetica, Arial, sans-serif'
                fontWeight="300"
                fontStyle="italic"
                fill="#444444"
                style={{ userSelect: 'none', pointerEvents: 'none' }}
              >
                {tick.labelMin}
              </text>
            );
          }
        })}

      {/* Center knob rotates with the dial sector */}
      <g transform={`rotate(${arcAngle} ${CENTER} ${CENTER})`}>
        <circle cx={CENTER} cy={CENTER} r={KNOB_R} fill="url(#knob-metal)" stroke="#909090" strokeWidth="0.8" />
        <circle cx={CENTER} cy={CENTER} r={KNOB_R} fill="url(#knob-shine)" />

        <rect
          x={CENTER - POINTER_W / 2}
          y={CENTER - KNOB_R - POINTER_PROTRUSION}
          width={POINTER_W}
          height={POINTER_H}
          rx={POINTER_W / 2}
          fill="url(#knob-metal)"
          stroke="#8b8b8a"
          strokeWidth="0.35"
        />

        <circle cx={CENTER} cy={CENTER} r={KNOB_R} fill="none" stroke="#606060" strokeWidth="0.5" opacity="0.5" />
      </g>
    </svg>
  );
}
