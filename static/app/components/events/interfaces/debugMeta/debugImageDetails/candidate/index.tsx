import styled from '@emotion/styled';

import {INTERNAL_SOURCE} from 'sentry/components/events/interfaces/debugMeta/debugImageDetails/utils';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import type {ImageCandidate} from 'sentry/types/debugImage';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';

import {StatusTooltip} from './status/statusTooltip';
import {Actions} from './actions';
import {Information} from './information';

type Props = {
  baseUrl: string;
  candidate: ImageCandidate;
  hasReprocessWarning: boolean;
  haveCandidatesAtLeastOneAction: boolean;
  onDelete: (debugFileId: string) => void;
  organization: Organization;
  projSlug: Project['slug'];
  eventDateReceived?: string;
};

export function Candidate({
  candidate,
  organization,
  projSlug,
  baseUrl,
  haveCandidatesAtLeastOneAction,
  hasReprocessWarning,
  onDelete,
  eventDateReceived,
}: Props) {
  const {source} = candidate;
  const isInternalSource = source === INTERNAL_SOURCE;

  return (
    <SimpleTable.Row>
      <Column>
        <StatusTooltip candidate={candidate} hasReprocessWarning={hasReprocessWarning} />
      </Column>

      <InformationColumn>
        <Information
          candidate={candidate}
          isInternalSource={isInternalSource}
          eventDateReceived={eventDateReceived}
          hasReprocessWarning={hasReprocessWarning}
        />
      </InformationColumn>

      {haveCandidatesAtLeastOneAction && (
        <ActionsColumn>
          <Actions
            onDelete={onDelete}
            baseUrl={baseUrl}
            projSlug={projSlug}
            organization={organization}
            candidate={candidate}
            isInternalSource={isInternalSource}
          />
        </ActionsColumn>
      )}
    </SimpleTable.Row>
  );
}

const Column = styled(SimpleTable.RowCell)`
  display: flex;
  align-items: center;
`;

const InformationColumn = styled(Column)`
  flex-direction: column;
  align-items: flex-start;
`;

const ActionsColumn = styled(Column)`
  justify-content: flex-end;
`;
