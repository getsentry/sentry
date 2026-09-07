import {useEffect, useState} from 'react';

import {ISSUE_DETAILS_LAZY_RENDER_OBSERVER_OPTIONS} from 'sentry/components/events/issueDetailsLazyRender';

function supportsIntersectionObserver(): boolean {
  return 'IntersectionObserver' in window;
}

// Reports whether `ref` has scrolled into view; latches true on first sight so
// the windowed enrichment fires at most once per card and never thrashes.
export function useIsInView(ref: React.RefObject<Element | null>): boolean {
  const [inView, setInView] = useState(() => !supportsIntersectionObserver());

  useEffect(() => {
    if (inView) {
      return;
    }
    const node = ref.current;
    if (!node) {
      return;
    }
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        setInView(true);
      }
    }, ISSUE_DETAILS_LAZY_RENDER_OBSERVER_OPTIONS);
    observer.observe(node);
    return () => observer.disconnect();
  }, [ref, inView]);

  return inView;
}
