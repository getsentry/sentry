import {Fragment, useCallback, useState, type ComponentProps} from 'react';
import {AnimatePresence} from 'framer-motion';

import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
import {Container, Flex} from '@sentry/scraps/layout';
import {SlideOverPanel} from '@sentry/scraps/slideOverPanel';

import Placeholder from 'sentry/components/placeholder';

export function SlideOverPanelPlayground() {
  const [isPanelOpen, setIsPanelOpen] = useState<boolean>(false);

  return (
    <Fragment>
      <Button onClick={() => setIsPanelOpen(true)}>Open Panel</Button>

      {isPanelOpen && (
        <SlideOverPanel position="right">
          <Container border="primary" height="100%" padding="md">
            <Button onClick={() => setIsPanelOpen(false)}>Close Panel</Button>
          </Container>
        </SlideOverPanel>
      )}
    </Fragment>
  );
}

export function SlideOverPanelSkeletonPlayground() {
  const [isPanelOpen, setIsPanelOpen] = useState<boolean>(false);

  const closePanel = useCallback(() => {
    setIsPanelOpen(false);
  }, []);

  return (
    <Fragment>
      <Button onClick={() => setIsPanelOpen(true)}>Open Panel</Button>

      <AnimatePresence>
        {isPanelOpen && (
          <SlideOverPanel position="right">
            {(options: {isOpening: boolean}) => {
              return options.isOpening ? (
                <SkeletonPanelContents onClick={closePanel} />
              ) : (
                <PanelContents onClick={closePanel} />
              );
            }}
          </SlideOverPanel>
        )}
      </AnimatePresence>
    </Fragment>
  );
}

interface PanelContentsProps {
  onClick: ComponentProps<typeof Button>['onClick'];
}

function PanelContents({onClick}: PanelContentsProps) {
  return (
    <Flex direction="column" border="primary" height="100%" gap="md" padding="md">
      <Button onClick={onClick}>Close Panel</Button>
      <Container>
        <Alert variant="warning">I took a very long time to render!</Alert>
        <ManySlowComponents />
      </Container>
    </Flex>
  );
}

export function SkeletonPanelContents({onClick}: PanelContentsProps) {
  return (
    <Flex direction="column" border="primary" height="100%" gap="md" padding="md">
      <Button onClick={onClick}>Close Panel</Button>
      <Container>
        <Placeholder />
      </Container>
    </Flex>
  );
}

function ManySlowComponents() {
  return (
    <Fragment>
      {[...new Array(100)].map((_, index) => (
        <VerySlowComponent key={index} />
      ))}
    </Fragment>
  );
}

export function VerySlowComponent() {
  const start = performance.now();

  const SLOW_COMPONENT_RENDER_DURATION = 20;

  while (performance.now() < start + SLOW_COMPONENT_RENDER_DURATION) {
    // Do nothing
  }

  return null;
}
