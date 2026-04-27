import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

export function useTabState<T extends string>(
  paramKey: string,
  defaultValue: T
): [T, (value: T) => void] {
  const [searchParams, setSearchParams] = useSearchParams({});

  const currentTab = (searchParams.get(paramKey) as T) || defaultValue;

  const setTab = useCallback(
    (tab: T) => {
      const next = new URLSearchParams(searchParams);
      if (tab === defaultValue) {
        next.delete(paramKey);
      } else {
        next.set(paramKey, tab);
      }
      setSearchParams(next);
    },
    [searchParams, setSearchParams, paramKey, defaultValue]
  );

  return [currentTab, setTab];
}
