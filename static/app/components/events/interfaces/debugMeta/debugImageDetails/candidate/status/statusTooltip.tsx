import styled from '@emotion/styled';

import {Tooltip} from '@sentry/scraps/tooltip';

import {getStatusTooltipDescription} from 'sentry/components/events/interfaces/debugMeta/debugImageDetails/candidate/utils';
import {space} from 'sentry/styles/space';
import type {ImageCandidate} from 'sentry/types/debugImage';

import Status from '.';

type Props = {
  candidate: ImageCandidate;
  hasReprocessWarning: boolean;
};

function StatusTooltip({candidate, hasReprocessWarning}: Props) {
  const {download} = candidate;
  const {label, description, disabled} = getStatusTooltipDescription(
    candidate,
    hasReprocessWarning
  );

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
      <Status data-test-id="status" status={download.status} />
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
