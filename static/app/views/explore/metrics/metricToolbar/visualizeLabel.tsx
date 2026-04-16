import type {MouseEventHandler} from 'react';
import styled from '@emotion/styled';

import {Container, Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {IconChevron, IconShow} from 'sentry/icons';
import {IconHide} from 'sentry/icons/iconHide';
import {useOrganization} from 'sentry/utils/useOrganization';
import {canUseMetricsUIRefresh} from 'sentry/views/explore/metrics/metricsFlags';
import type {Visualize} from 'sentry/views/explore/queryParams/visualize';

interface VisualizeLabelProps {
  label: string;
  onClick: MouseEventHandler<HTMLDivElement>;
  visualize: Visualize;
}

export function VisualizeLabel({label, onClick, visualize}: VisualizeLabelProps) {
  const organization = useOrganization();

  if (canUseMetricsUIRefresh(organization)) {
    return (
      <Container
        display="flex"
        cursor="pointer"
        onClick={onClick}
        style={{userSelect: 'none', WebkitTapHighlightColor: 'transparent'}}
      >
        <Flex align="center" gap="xs">
          <IconChevron size="md" direction={visualize.visible ? 'down' : 'right'} />
          <RefreshLabel justify="center" align="center">
            <Text as="span" bold variant="accent">
              {label}
            </Text>
          </RefreshLabel>
        </Flex>
      </Container>
    );
  }

  const icon = visualize.visible ? <IconShow /> : <IconHide />;

  return (
    <Flex align="center" justify="start" gap="md">
      <IconLabel onClick={onClick} height="36px" justify="center" align="center">
        {icon}
      </IconLabel>
      <Text bold size="md">
        {label}
      </Text>
    </Flex>
  );
}

const RefreshLabel = styled(Flex)`
  background-color: ${p => p.theme.tokens.background.transparent.accent.muted};
  color: ${p => p.theme.tokens.content.accent};
  width: 24px;
  height: 36px;
  border-radius: ${p => p.theme.radius.md};
`;

const IconLabel = styled(Flex)`
  cursor: pointer;
  font-weight: bold;
  color: ${p => p.theme.tokens.content.accent};
`;
