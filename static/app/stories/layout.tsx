import styled from '@emotion/styled';

import NegativeSpaceContainer from 'sentry/components/container/negativeSpaceContainer';
import {Flex} from 'sentry/components/core/layout';

export const SideBySide = styled(
  (props: {children: React.ReactNode; vertical?: boolean}) => {
    return (
      <Flex
        gap="xl"
        align="start"
        wrap="wrap"
        direction={props.vertical ? 'column' : 'row'}
      >
        {props.children}
      </Flex>
    );
  }
)``;

export const Grid = styled('div')<{columns?: number}>`
  display: grid;
  grid-template-columns: ${p =>
    p.columns ? `repeat(${p.columns}, 1fr)` : 'repeat(auto-fit, minmax(300px, 1fr))'};
  gap: ${p => p.theme.space.xl};
  grid-auto-rows: auto;
  align-items: start;
`;

export const SizingWindow = styled(NegativeSpaceContainer)<{display?: 'block' | 'flex'}>`
  border: 1px solid ${p => p.theme.yellow400};
  border-radius: ${p => p.theme.borderRadius};

  resize: both;
  padding: ${p => p.theme.space.xl};
  display: ${p => (p.display === 'block' ? 'block' : 'flex')};
  overflow: ${p => (p.display === 'block' ? 'auto' : 'hidden')};
`;

export const Section = styled('section')`
  padding-top: ${p => p.theme.space['3xl']};
  display: flex;
  flex-direction: column;
  gap: ${p => p.theme.space.xl};
`;
