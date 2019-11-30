import { useState, useEffect } from 'react';

export default function useDebouncedValue(value, delay) {
  let [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    let timer = setTimeout(setDebouncedValue, delay, value);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}
