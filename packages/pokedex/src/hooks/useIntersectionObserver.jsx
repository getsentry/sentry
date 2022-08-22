import { useEffect, useRef } from "react";

export const useIntersectionObserver = (callback, deps = []) => {
  const ref = useRef(null);

  useEffect(() => {
    if (!window.IntersectionObserver || !ref?.current) return;
    const node = ref.current;

    function handleEntries([entry]) {
      if (entry.isIntersecting) {
        callback();
      }
    }

    const options = { threshold: 0.1 };
    const observer = new IntersectionObserver(handleEntries, options);
    observer.observe(node);

    return () => observer.unobserve(node);
  }, deps);

  return ref;
};
