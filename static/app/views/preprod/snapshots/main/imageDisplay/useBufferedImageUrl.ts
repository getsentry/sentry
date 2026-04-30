import {useEffect, useRef, useState} from 'react';

export function useBufferedImageUrl(targetUrl: string): string | null {
  const [displayUrl, setDisplayUrl] = useState<string | null>(null);
  const activeUrlRef = useRef<string | null>(null);

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
    };
  }, [targetUrl]);

  return displayUrl;
}

export function useBufferedImageGroup(
  targetUrls: ReadonlyArray<string | null>
): Array<string | null> {
  const serialized = targetUrls.join('\0');
  const targetUrlsRef = useRef(targetUrls);
  targetUrlsRef.current = targetUrls;

  const [displayUrls, setDisplayUrls] = useState<Array<string | null>>(() =>
    targetUrls.map(() => null)
  );
  const activeKeyRef = useRef('');

  useEffect(() => {
    if (serialized === activeKeyRef.current) {
      return undefined;
    }

    const urls = targetUrlsRef.current;
    let cancelled = false;

    const promises = urls.map(url => {
      if (!url) {
        return Promise.resolve();
      }
      const img = new Image();
      img.src = url;
      return img.decode().catch(() => undefined);
    });

    Promise.all(promises).then(() => {
      if (!cancelled) {
        activeKeyRef.current = serialized;
        setDisplayUrls([...urls]);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [serialized]);

  return displayUrls;
}
