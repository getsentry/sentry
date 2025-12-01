import {Fragment, useState} from 'react';
import {AnimatePresence} from 'framer-motion';

import {Button} from '@sentry/scraps/button';
import {Container} from '@sentry/scraps/layout';
import {SlideOverPanel} from '@sentry/scraps/slideOverPanel';

export function SlideOverPanelPlayground() {
  const [isPanelOpen, setIsPanelOpen] = useState<boolean>(false);

  return (
    <Fragment>
      <Button onClick={() => setIsPanelOpen(true)}>Open Panel</Button>

      <AnimatePresence>
        {isPanelOpen && (
          <SlideOverPanel isOpen slidePosition="right">
            <Container border="primary" height="100%" padding="md">
              <Button onClick={() => setIsPanelOpen(false)}>Close Panel</Button>
            </Container>
          </SlideOverPanel>
        )}
      </AnimatePresence>
    </Fragment>
  );
}
