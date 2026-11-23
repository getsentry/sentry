import {Fragment, useEffect, useRef, useState, type RefObject} from 'react';
import {IconArrow} from '@sentry/icons/arrow';
import * as Sentry from '@sentry/react';

import {Button} from '@sentry/scraps/button';
import {Container, Flex} from '@sentry/scraps/layout';

import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useOrganization} from 'sentry/utils/useOrganization';

// How close to the end of the content counts as already being there.
const AT_END_MARGIN_PX = 64;

interface JumpToEndButtonProps {
  /** Whether another page can be loaded without user action. */
  canLoadMore: boolean;
  loadRemainingPages: (signal: AbortSignal) => Promise<number>;
  loadedPageCount: number;
  scrollContainerRef: RefObject<HTMLElement | null>;
}

/**
 * Floats at the bottom of the conversation's scroll container and scrolls to the
 * end of the conversation.
 *
 * The API pages spans oldest-first with no total, and the transcript and timeline
 * are both built from every span before it, so the end can only be shown once the
 * pages before it are loaded. The button loads them, then scrolls.
 *
 * Render it as the last child of the scroll container, keyed by what it scrolls,
 * so that a jump in progress doesn't carry over to another conversation or tab.
 */
export function JumpToEndButton({
  canLoadMore,
  loadedPageCount,
  loadRemainingPages,
  scrollContainerRef,
}: JumpToEndButtonProps) {
  const organization = useOrganization();
  const endRef = useRef<HTMLDivElement>(null);
  const [isAtEnd, setIsAtEnd] = useState(false);
  const [isJumping, setIsJumping] = useState(false);
  // The page count to wait for, as the loaded pages render after the load resolves.
  const [scrollAtPageCount, setScrollAtPageCount] = useState<number | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const end = endRef.current;
    if (!end) {
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => setIsAtEnd(entry?.isIntersecting ?? false),
      {root: scrollContainerRef.current, rootMargin: `0px 0px ${AT_END_MARGIN_PX}px 0px`}
    );
    observer.observe(end);
    return () => observer.disconnect();
  }, [scrollContainerRef]);

  useEffect(() => {
    if (scrollAtPageCount === null || loadedPageCount < scrollAtPageCount) {
      return;
    }
    // After a failed page, this reveals the Retry button at the end.
    const container = scrollContainerRef.current;
    container?.scrollTo({top: container.scrollHeight});
    // oxlint-disable-next-line react/set-state-in-effect
    setScrollAtPageCount(null);
  }, [loadedPageCount, scrollAtPageCount, scrollContainerRef]);

  // Scrolling while pages load means the user wants to read where they are.
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!isJumping || !container) {
      return;
    }
    const cancel = () => abortControllerRef.current?.abort();
    container.addEventListener('wheel', cancel, {passive: true});
    container.addEventListener('touchmove', cancel, {passive: true});
    return () => {
      container.removeEventListener('wheel', cancel);
      container.removeEventListener('touchmove', cancel);
    };
  }, [isJumping, scrollContainerRef]);

  useEffect(() => () => abortControllerRef.current?.abort(), []);

  const handleClick = async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      return;
    }
    trackAnalytics('conversations.detail.jump-to-end', {organization});
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setIsJumping(true);
    try {
      const pageCount = await loadRemainingPages(controller.signal);
      if (!controller.signal.aborted) {
        setScrollAtPageCount(pageCount);
      }
    } catch (error) {
      Sentry.captureException(error);
    }
    abortControllerRef.current = null;
    setIsJumping(false);
  };

  const isVisible = isJumping || scrollAtPageCount !== null || canLoadMore || !isAtEnd;

  return (
    // A fragment, as a wrapper would confine the sticky button to its own height.
    <Fragment>
      <Container ref={endRef} height="1px" />
      {isVisible ? (
        <Flex
          position="sticky"
          bottom="0"
          height="0"
          align="end"
          justify="center"
          style={{zIndex: 1}}
        >
          <Container paddingBottom="md">
            <Button
              size="sm"
              icon={
                isJumping ? (
                  <LoadingIndicator size={14} />
                ) : (
                  <IconArrow direction="down" size="xs" />
                )
              }
              onClick={handleClick}
            >
              {isJumping ? t('Stop loading') : t('Jump to end')}
            </Button>
          </Container>
        </Flex>
      ) : null}
    </Fragment>
  );
}
