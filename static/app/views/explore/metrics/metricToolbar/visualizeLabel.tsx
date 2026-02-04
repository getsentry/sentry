import type {MouseEventHandler} from 'react';
import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {IconShow} from 'sentry/icons';
import {IconHide} from 'sentry/icons/iconHide';
import type {Visualize} from 'sentry/views/explore/queryParams/visualize';
import {getVisualizeLabel} from 'sentry/views/explore/toolbar/toolbarVisualize';

interface VisualizeLabelProps {
  index: number;
  onClick: MouseEventHandler<HTMLDivElement>;
  visualize: Visualize;
}

export function VisualizeLabel({index, onClick, visualize}: VisualizeLabelProps) {
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

const IconLabel = styled(Flex)`
  cursor: pointer;
  font-weight: bold;
  color: ${p => p.theme.tokens.content.accent};
`;
