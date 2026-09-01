"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * State yang tersinkron ke localStorage. Aman untuk SSR (baca hanya di client).
 */
export function usePersistentState<T>(
  key: string,
  initial: T | (() => T)
): [T, (v: T | ((prev: T) => T)) => void, boolean] {
  const [hydrated, setHydrated] = useState(false);
  const [state, setState] = useState<T>(
    typeof initial === "function" ? (initial as () => T)() : initial
  );
  const keyRef = useRef(key);
  keyRef.current = key;

  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw != null) setState(JSON.parse(raw) as T);
    } catch {
      /* ignore corrupt / unavailable storage */
    }
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const set = useCallback((v: T | ((prev: T) => T)) => {
    setState((prev) => {
      const next =
        typeof v === "function" ? (v as (p: T) => T)(prev) : v;
      try {
        localStorage.setItem(keyRef.current, JSON.stringify(next));
      } catch {
        /* quota / private mode */
      }
      return next;
    });
  }, []);

  return [state, set, hydrated];
}
