import type {MouseEventHandler} from 'react';
import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {IconShow} from 'sentry/icons';
import {IconHide} from 'sentry/icons/iconHide';
import {useOrganization} from 'sentry/utils/useOrganization';
import {canUseMetricsUIRefresh} from 'sentry/views/explore/metrics/metricsFlags';
import type {Visualize} from 'sentry/views/explore/queryParams/visualize';
import {getVisualizeLabel} from 'sentry/views/explore/toolbar/toolbarVisualize';

interface VisualizeLabelProps {
  index: number;
  onClick: MouseEventHandler<HTMLDivElement>;
  visualize: Visualize;
}

export function VisualizeLabel({index, onClick, visualize}: VisualizeLabelProps) {
  const organization = useOrganization();

  if (canUseMetricsUIRefresh(organization)) {
    const label = visualize.visible ? (
      <Text as="span" bold variant="accent">
        {getVisualizeLabel(index)}
      </Text>
    ) : (
      <IconHide />
    );

    return (
      <RefreshLabel onClick={onClick} justify="center" align="center">
        {label}
      </RefreshLabel>
    );
  }

  const label = getVisualizeLabel(index);
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
  cursor: pointer;
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
