import type {MouseEventHandler} from 'react';
import styled from '@emotion/styled';

import {Container, Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {IconChevron} from 'sentry/icons';
import type {Visualize} from 'sentry/views/explore/queryParams/visualize';

interface VisualizeLabelProps {
  label: string;
  onClick: MouseEventHandler<HTMLDivElement>;
  visualize: Visualize;
  disableCollapse?: boolean;
}

export function VisualizeLabel({
  label,
  onClick,
  visualize,
  disableCollapse,
}: VisualizeLabelProps) {
  return (
    <Container
      display="flex"
      cursor={disableCollapse ? 'default' : 'pointer'}
      onClick={onClick}
      style={{userSelect: 'none', WebkitTapHighlightColor: 'transparent'}}
    >
      <Flex align="center" gap="xs">
        {!disableCollapse && (
          <IconChevron size="md" direction={visualize.visible ? 'down' : 'right'} />
        )}
        <VisualizeLabelBadge
          justify="center"
          align="center"
          width="24px"
          height="36px"
          radius="md"
        >
          <Text as="span" bold variant="accent">
            {label}
          </Text>
        </VisualizeLabelBadge>
      </Flex>
    </Container>
  );
}

const VisualizeLabelBadge = styled(Flex)`
  background-color: ${p => p.theme.tokens.background.transparent.accent.muted};
`;
