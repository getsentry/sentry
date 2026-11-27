import {useEffect, useLayoutEffect, useState, type RefObject} from 'react';
import {IconArrow} from '@sentry/icons/arrow';
import * as Sentry from '@sentry/react';

import {Button} from '@sentry/scraps/button';
import {Container, Flex} from '@sentry/scraps/layout';

import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useOrganization} from 'sentry/utils/useOrganization';

interface JumpToEndButtonProps {
  canLoadMore: boolean;
  isAtEnd: boolean | null;
  loadRemainingPages: (signal: AbortSignal) => Promise<number>;
  loadedPageCount: number;
  scrollContainerRef: RefObject<HTMLElement | null>;
}

export function JumpToEndButton({
  canLoadMore,
  isAtEnd,
  loadedPageCount,
  loadRemainingPages,
  scrollContainerRef,
}: JumpToEndButtonProps) {
  const organization = useOrganization();
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  // Pages render after the load resolves, so the scroll waits for this page count.
  const [scrollAtPageCount, setScrollAtPageCount] = useState<number | null>(null);
  const isJumping = abortController !== null;

  useLayoutEffect(() => {
    if (scrollAtPageCount === null || loadedPageCount < scrollAtPageCount) {
      return;
    }
    const container = scrollContainerRef.current;
    container?.scrollTo({top: container.scrollHeight});
    // oxlint-disable-next-line react/set-state-in-effect
    setScrollAtPageCount(null);
  }, [loadedPageCount, scrollAtPageCount, scrollContainerRef]);

  useEffect(() => {
    if (!abortController) {
      return;
    }
    const {signal} = abortController;
    const cancel = () => abortController.abort();
    const container = scrollContainerRef.current;
    container?.addEventListener('wheel', cancel, {passive: true, signal});
    container?.addEventListener('touchmove', cancel, {passive: true, signal});
    return cancel;
  }, [abortController, scrollContainerRef]);

  const handleClick = async () => {
    if (abortController) {
      abortController.abort();
      return;
    }
    trackAnalytics('conversations.detail.jump-to-end', {organization});
    const controller = new AbortController();
    setAbortController(controller);
    try {
      const pageCount = await loadRemainingPages(controller.signal);
      if (!controller.signal.aborted) {
        setScrollAtPageCount(pageCount);
      }
    } catch (error) {
      Sentry.captureException(error);
    }
    setAbortController(null);
  };

  const isVisible = isJumping || canLoadMore || isAtEnd === false;

  if (!isVisible) {
    return null;
  }

  return (
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
              <LoadingIndicator size={14} style={{margin: 0}} />
            ) : (
              <IconArrow direction="down" />
            )
          }
          onClick={handleClick}
        >
          {isJumping ? t('Stop loading') : t('Jump to end')}
        </Button>
      </Container>
    </Flex>
  );
}
