import React from 'react';
import styled from '@emotion/styled';

import Tooltip from 'app/components/tooltip';
import space from 'app/styles/space';
import {ImageCandidate} from 'app/types/debugImage';

import Status from './status';
import {getStatusTooltipDescription} from './utils';

type Props = {
  candidate: ImageCandidate;
};

function StatusTooltip({candidate}: Props) {
  const {download} = candidate;
  const {label, description, disabled} = getStatusTooltipDescription(candidate);

  return (
    <Tooltip
      title={
        label && (
          <Title>
            <Label>{label}</Label>
            {description && <div>{description}</div>}
          </Title>
        )
      }
      disabled={disabled}
    >
      <Status status={download.status} />
    </Tooltip>
  );
}

export default StatusTooltip;

const Title = styled('div')`
  text-align: left;
`;

const Label = styled('div')`
  display: inline-block;
  margin-bottom: ${space(0.25)};
`;
