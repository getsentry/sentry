import styled from '@emotion/styled';

import NegativeSpaceContainer from 'sentry/components/container/negativeSpaceContainer';
import {Flex, type FlexProps} from 'sentry/components/core/layout';

interface SideBySideProps extends Omit<FlexProps, 'direction' | 'children'> {
  children: React.ReactNode;
  vertical?: boolean;
}

export const SideBySide = styled(({children, vertical, ...rest}: SideBySideProps) => (
  <Flex
    direction={vertical ? 'column' : 'row'}
    gap="xl"
    wrap="wrap"
    align="start"
    {...rest}
  >
    {children}
  </Flex>
))<SideBySideProps>``;

export const Grid = styled('div')<{columns?: number}>`
  display: grid;
  grid-template-columns: ${p =>
    p.columns ? `repeat(${p.columns}, 1fr)` : 'repeat(auto-fit, minmax(300px, 1fr))'};
  gap: ${p => p.theme.space.xl};
  grid-auto-rows: auto;
  align-items: start;
`;

export const SizingWindow = styled(NegativeSpaceContainer)<{display?: 'block' | 'flex'}>`
  border: 1px solid ${p => p.theme.colors.yellow500};
  border-radius: ${p => p.theme.radius.md};

  resize: both;
  padding: ${p => p.theme.space.xl};
  display: ${p => (p.display === 'block' ? 'block' : 'flex')};
  overflow: ${p => (p.display === 'block' ? 'auto' : 'hidden')};
`;

export const Section = styled('section')`
  min-width: 0;
  padding-top: ${p => p.theme.space['3xl']};
  display: flex;
  flex-direction: column;
  gap: ${p => p.theme.space.xl};
`;
