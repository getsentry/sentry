import {useCallback, useEffect, useRef, type ReactNode} from 'react';
import styled from '@emotion/styled';
import {mergeRefs} from '@react-aria/utils';

import {AutofixStepType} from 'sentry/components/events/autofix/types';
import {type useAiAutofix} from 'sentry/components/events/autofix/useAutofix';
import {DrawerBody} from 'sentry/components/globalDrawer/components';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';

interface SeerDrawerBody {
  aiAutofix: ReturnType<typeof useAiAutofix>;
  children: ReactNode;
}

export function SeerDrawerBody({children, aiAutofix}: SeerDrawerBody) {
  const {scrollContainerRef: scrollToSectionRef} = useScrollToSection({aiAutofix});

  const {handleScroll, scrollContainerRef: autoScrollRef} = useAutoScroll({aiAutofix});

  const scrollContainerRef = mergeRefs(scrollToSectionRef, autoScrollRef);

  return (
    <StyledDrawerBody ref={scrollContainerRef} onScroll={handleScroll}>
      {children}
    </StyledDrawerBody>
  );
}

function useScrollToSection({aiAutofix}: {aiAutofix: ReturnType<typeof useAiAutofix>}) {
  const location = useLocation();
  const navigate = useNavigate();

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const autofixDataRef = useRef(aiAutofix.autofixData);
  autofixDataRef.current = aiAutofix.autofixData;

  const scrollToSection = useCallback(
    (sectionType: string | null) => {
      if (!scrollContainerRef.current || !autofixDataRef.current) {
        return;
      }

      const step = autofixDataRef.current.steps?.find(s => {
        if (sectionType === 'root_cause')
          return s.type === AutofixStepType.ROOT_CAUSE_ANALYSIS;
        if (sectionType === 'solution') return s.type === AutofixStepType.SOLUTION;
        if (sectionType === 'code_changes') return s.type === AutofixStepType.CHANGES;
        return false;
      });

      let element = null;

      if (step) {
        const elementId = `autofix-step-${step.id}`;
        element = document.getElementById(elementId);
      }

      if (element) {
        element.scrollIntoView({behavior: 'smooth'});
      } else {
        // No matching step found, scroll to bottom
        scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
      }

      // Clear the scrollTo parameter from the URL after scrolling
      setTimeout(() => {
        navigate(
          {
            pathname: location.pathname,
            query: {
              ...location.query,
              scrollTo: undefined,
            },
          },
          {replace: true}
        );
      }, 200);
    },
    [location, navigate]
  );

  useEffect(() => {
    const scrollTo = location.query.scrollTo as string | undefined;
    if (scrollTo) {
      // use a 100ms timeout to allow the page to render first
      const timeoutId = setTimeout(() => {
        scrollToSection(scrollTo);
      }, 100);
      return () => clearTimeout(timeoutId);
    }
    return () => {};
  }, [location.query.scrollTo, scrollToSection]);

  return {scrollContainerRef};
}

function useAutoScroll({aiAutofix}: {aiAutofix: ReturnType<typeof useAiAutofix>}) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const lastScrollTopRef = useRef(0);
  const shouldAutoScrollRef = useRef(true);

  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) {
      return;
    }

    // Detect scroll direction
    const scrollingUp = container.scrollTop < lastScrollTopRef.current;

    // update the last scroll position, make sure to do so after using the last value
    lastScrollTopRef.current = container.scrollTop;

    // Check if we're at the bottom
    const isAtBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight < 1;

    // Disable auto-scroll if scrolling up
    if (scrollingUp) {
      shouldAutoScrollRef.current = false;
    }

    // Re-enable auto-scroll if we reach the bottom
    if (isAtBottom) {
      shouldAutoScrollRef.current = true;
    }
  }, []);

  useEffect(() => {
    // Only auto-scroll if user hasn't manually scrolled
    if (shouldAutoScrollRef.current && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [aiAutofix.autofixData]);

  return {
    handleScroll,
    scrollContainerRef,
  };
}

const StyledDrawerBody = styled(DrawerBody)`
  overflow-y: scroll;
`;
