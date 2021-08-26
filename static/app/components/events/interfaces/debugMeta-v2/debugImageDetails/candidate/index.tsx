import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Organization, Project} from 'app/types';
import {BuiltinSymbolSource} from 'app/types/debugFiles';
import {ImageCandidate} from 'app/types/debugImage';

import {INTERNAL_SOURCE} from '../utils';

import StatusTooltip from './status/statusTooltip';
import Actions from './actions';
import Information from './information';

type Props = {
  candidate: ImageCandidate;
  builtinSymbolSources: Array<BuiltinSymbolSource> | null;
  organization: Organization;
  projectId: Project['slug'];
  baseUrl: string;
  haveCandidatesAtLeastOneAction: boolean;
  hasReprocessWarning: boolean;
  onDelete: (debugFileId: string) => void;
  eventDateReceived?: string;
};

function Candidate({
  candidate,
  builtinSymbolSources,
  organization,
  projectId,
  baseUrl,
  haveCandidatesAtLeastOneAction,
  hasReprocessWarning,
  onDelete,
  eventDateReceived,
}: Props) {
  const {source} = candidate;
  const isInternalSource = source === INTERNAL_SOURCE;

  return (
    <Fragment>
      <Column>
        <StatusTooltip candidate={candidate} hasReprocessWarning={hasReprocessWarning} />
      </Column>

      <InformationColumn>
        <Information
          candidate={candidate}
          builtinSymbolSources={builtinSymbolSources}
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
            projectId={projectId}
            organization={organization}
            candidate={candidate}
            isInternalSource={isInternalSource}
          />
        </ActionsColumn>
      )}
    </Fragment>
  );
}

export default Candidate;

const Column = styled('div')`
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
