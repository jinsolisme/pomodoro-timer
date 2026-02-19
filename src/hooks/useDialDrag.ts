import { useCallback, useEffect, useRef, useState } from 'react';

const MIN_MINUTES = 1;
const MAX_MINUTES = 60;

/**
 * Converts an angle (degrees, clockwise from 12 o'clock = 0°) to minutes (1–60).
 * Full circle (360°) = 60 minutes.
 */
function angleToMinutes(angleDeg: number): number {
  const raw = Math.round((angleDeg / 360) * MAX_MINUTES);
  return Math.max(MIN_MINUTES, Math.min(MAX_MINUTES, raw));
}

/**
 * Returns angle in degrees clockwise from 12 o'clock (top), range [0, 360).
 */
function getAngleFromCenter(
  cx: number,
  cy: number,
  x: number,
  y: number,
): number {
  // atan2 returns angle from positive X axis counter-clockwise
  const rad = Math.atan2(y - cy, x - cx);
  // Convert: 0° at top, clockwise
  let deg = (rad * 180) / Math.PI + 90;
  if (deg < 0) deg += 360;
  return deg % 360;
}

interface UseDialDragOptions {
  svgRef: React.RefObject<SVGSVGElement | null>;
  onDragEnd: (minutes: number) => void;
}

interface UseDialDragReturn {
  isDragging: boolean;
  dragMinutes: number; // current minutes while dragging (0 = not dragging)
  angleDeg: number;    // sweep angle in degrees for rendering the arc
}

export function useDialDrag({
  svgRef,
  onDragEnd,
}: UseDialDragOptions): UseDialDragReturn {
  const [isDragging, setIsDragging] = useState(false);
  const [angleDeg, setAngleDeg] = useState(0);
  const [dragMinutes, setDragMinutes] = useState(0);
  const draggingRef = useRef(false);

  const getCenter = useCallback((): { cx: number; cy: number } | null => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    return {
      cx: rect.left + rect.width / 2,
      cy: rect.top + rect.height / 2,
    };
  }, [svgRef]);

  const handleMove = useCallback(
    (clientX: number, clientY: number) => {
      if (!draggingRef.current) return;
      const center = getCenter();
      if (!center) return;
      const { cx, cy } = center;
      const angle = getAngleFromCenter(cx, cy, clientX, clientY);
      // Clamp: 0 angle (exactly 12 o'clock without movement) → treat as max
      const clampedAngle = angle === 0 ? 360 : angle;
      setAngleDeg(clampedAngle);
      setDragMinutes(angleToMinutes(clampedAngle));
    },
    [getCenter],
  );

  const handleEnd = useCallback(
    (clientX: number, clientY: number) => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      setIsDragging(false);

      const center = getCenter();
      if (!center) return;
      const { cx, cy } = center;
      const angle = getAngleFromCenter(cx, cy, clientX, clientY);
      const clampedAngle = angle === 0 ? 360 : angle;
      const minutes = angleToMinutes(clampedAngle);

      if (minutes >= MIN_MINUTES) {
        onDragEnd(minutes);
      }

      // Reset drag display — timer visuals take over
      setAngleDeg(0);
      setDragMinutes(0);
    },
    [getCenter, onDragEnd],
  );

  // Mouse events
  const handleMouseDown = useCallback(
    (e: MouseEvent) => {
      e.preventDefault();
      draggingRef.current = true;
      setIsDragging(true);
      handleMove(e.clientX, e.clientY);
    },
    [handleMove],
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      handleMove(e.clientX, e.clientY);
    },
    [handleMove],
  );

  const handleMouseUp = useCallback(
    (e: MouseEvent) => {
      handleEnd(e.clientX, e.clientY);
    },
    [handleEnd],
  );

  // Touch events
  const handleTouchStart = useCallback(
    (e: TouchEvent) => {
      e.preventDefault();
      const touch = e.touches[0];
      draggingRef.current = true;
      setIsDragging(true);
      handleMove(touch.clientX, touch.clientY);
    },
    [handleMove],
  );

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      e.preventDefault();
      const touch = e.touches[0];
      handleMove(touch.clientX, touch.clientY);
    },
    [handleMove],
  );

  const handleTouchEnd = useCallback(
    (e: TouchEvent) => {
      const touch = e.changedTouches[0];
      handleEnd(touch.clientX, touch.clientY);
    },
    [handleEnd],
  );

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    svg.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    svg.addEventListener('touchstart', handleTouchStart, { passive: false });
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);

    return () => {
      svg.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);

      svg.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [
    svgRef,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
  ]);

  return { isDragging, dragMinutes, angleDeg };
}
