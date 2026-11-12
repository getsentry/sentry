import type {ComponentPropsWithRef} from 'react';
import {css} from '@emotion/react';
import {motion} from 'framer-motion';

import {Container} from '@sentry/scraps/layout';

import type {Widget} from './types';

interface WidgetWrapperProps extends ComponentPropsWithRef<typeof motion.div> {
  displayType: Widget['displayType'];
}

export function WidgetWrapper({displayType, ...motionProps}: WidgetWrapperProps) {
  return (
    <Container
      position="relative"
      area={
        displayType === 'big_number'
          ? {
              zero: 'span 1 / span 2',
              xl: 'span 1 / span 1',
              '5xl': 'span 1 / span 2',
            }
          : 'span 2 / span 2'
      }
      css={css`
        touch-action: manipulation;
      `}
    >
      {layoutProps => <motion.div {...motionProps} {...layoutProps} />}
    </Container>
  );
}
