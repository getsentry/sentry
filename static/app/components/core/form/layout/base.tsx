import {keyframes} from '@emotion/react';
import styled from '@emotion/styled';

import {Flex, Stack, type FlexProps} from '@sentry/scraps/layout';

interface BaseLayoutProps extends FlexProps<'div' | 'dl'> {
  stacked: boolean;
}

export function BaseLayout({stacked, ...props}: BaseLayoutProps) {
  return (
    <HighlightableFlex
      direction={stacked ? 'column' : 'row'}
      gap={stacked ? 'md' : 'xl'}
      align={stacked ? undefined : 'center'}
      justify={stacked ? undefined : 'between'}
      flexGrow={1}
      {...props}
    />
  );
}

type LayoutLabelProps = React.ComponentProps<typeof Stack> & {stacked: boolean};

export function LayoutLabel({stacked, ...props}: LayoutLabelProps) {
  return <Stack width={stacked ? undefined : '50%'} gap="xs" {...props} />;
}

const highlightFade = keyframes`
  0% {
    background-color: var(--highlight-color);
  }
  100% {
    background-color: transparent;
  }
`;

const HighlightableFlex = styled(Flex)`
  --highlight-color: ${p => p.theme.tokens.background.transparent.accent.muted};

  &[data-highlight] {
    animation: ${highlightFade} ${p => p.theme.motion.smooth.slow};
  }
`;
