import {Fragment, useCallback, useState, type ComponentProps} from 'react';
import {AnimatePresence} from 'framer-motion';

import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
import {Container, Flex} from '@sentry/scraps/layout';
import {SlideOverPanel} from '@sentry/scraps/slideOverPanel';
import {Switch} from '@sentry/scraps/switch';

import Placeholder from 'sentry/components/placeholder';

export function SlideOverPanelPlayground() {
  const [isPanelOpen, setIsPanelOpen] = useState<boolean>(false);

  return (
    <Fragment>
      <Button onClick={() => setIsPanelOpen(true)}>Open Panel</Button>

      <AnimatePresence>
        {isPanelOpen && (
          <SlideOverPanel collapsed={false} slidePosition="right">
            <Container border="primary" height="100%" padding="md">
              <Button onClick={() => setIsPanelOpen(false)}>Close Panel</Button>
            </Container>
          </SlideOverPanel>
        )}
      </AnimatePresence>
    </Fragment>
  );
}

export function SlideOverPanelSkeletonPlayground() {
  const [isPanelOpen, setIsPanelOpen] = useState<boolean>(false);
  const [isSkeletonEnabled, setIsSkeletonEnabled] = useState<boolean>(false);

  const closePanel = useCallback(() => {
    setIsPanelOpen(false);
  }, []);

  return (
    <Fragment>
      <Flex direction="column" gap="md">
        <Flex gap="md" as="label">
          Enable Skeleton UI
          <Switch
            checked={isSkeletonEnabled}
            onChange={() => setIsSkeletonEnabled(!isSkeletonEnabled)}
          />
        </Flex>
        <Button onClick={() => setIsPanelOpen(true)}>Open Panel</Button>
      </Flex>

      <AnimatePresence>
        <SlideOverPanel
          collapsed={!isPanelOpen}
          slidePosition="right"
          skeleton={isSkeletonEnabled ? <SkeletonPanel onClick={closePanel} /> : null}
        >
          <Flex direction="column" border="primary" height="100%" gap="md" padding="md">
            <Button onClick={closePanel}>Close Panel</Button>
            <Container>
              <Alert type="warning">I took a very long time to render!</Alert>
              <ManySlowComponents />
            </Container>
          </Flex>
        </SlideOverPanel>
      </AnimatePresence>
    </Fragment>
  );
}

interface SkeletonPanelProps {
  onClick: ComponentProps<typeof Button>['onClick'];
}

export function SkeletonPanel({onClick}: SkeletonPanelProps) {
  return (
    <Flex direction="column" border="primary" height="100%" gap="md" padding="md">
      <Button onClick={onClick}>Close Panel</Button>
      <Container>
        <Placeholder />
      </Container>
    </Flex>
  );
}

const RANGE: number[] = [];

for (let i = 0; i <= 100; i++) {
  RANGE.push(i);
}

function ManySlowComponents() {
  return (
    <Fragment>
      {RANGE.map(index => (
        <VerySlowComponent key={index} />
      ))}
    </Fragment>
  );
}

export function VerySlowComponent() {
  const start = performance.now();

  while (performance.now() < start + SLOW_COMPONENT_RENDER_DURATION) {
    // Do nothing
  }

  return null;
}

const SLOW_COMPONENT_RENDER_DURATION = 20;
