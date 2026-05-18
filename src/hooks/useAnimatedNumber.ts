import { useEffect, useState, useRef } from 'react';

export function useAnimatedNumber(target: number, duration = 600) {
  const [display, setDisplay] = useState(target);
  const prevTarget = useRef(target);
  const frameRef = useRef<number>();

  useEffect(() => {
    const startVal = prevTarget.current;
    const diff = target - startVal;
    if (diff === 0) {
      setDisplay(target);
      return;
    }

    const startTime = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      const current = Math.round(startVal + diff * eased);
      setDisplay(current);

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate);
      } else {
        setDisplay(target);
        prevTarget.current = target;
      }
    };

    frameRef.current = requestAnimationFrame(animate);

    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [target, duration]);

  return display;
}
