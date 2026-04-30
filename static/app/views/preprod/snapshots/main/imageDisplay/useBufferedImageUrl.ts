import {useEffect, useRef, useState} from 'react';

export function useBufferedImageUrl(targetUrl: string): string {
  const [displayUrl, setDisplayUrl] = useState(targetUrl);
  const activeUrlRef = useRef(targetUrl);

  useEffect(() => {
    if (targetUrl === activeUrlRef.current) {
      return undefined;
    }

    let cancelled = false;
    const img = new Image();
    img.src = targetUrl;
    img
      .decode()
      .catch(() => undefined)
      .then(() => {
        if (!cancelled) {
          activeUrlRef.current = targetUrl;
          setDisplayUrl(targetUrl);
        }
      });

    return () => {
      cancelled = true;
      img.src = '';
    };
  }, [targetUrl]);

  return displayUrl;
}
