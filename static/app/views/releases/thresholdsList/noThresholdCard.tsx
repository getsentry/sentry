import {useState} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import PanelTable from 'sentry/components/panels/panelTable';
import {IconAdd} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Project} from 'sentry/types';

import {ThresholdGroupRows} from './thresholdGroupRows';

type Props = {
  allEnvironmentNames: string[];
  project: Project;
  refetch: () => void;
  setTempError: (msg: string) => void;
};

export default function NoThresholdCard({
  project,
  allEnvironmentNames,
  refetch,
  setTempError,
}: Props) {
  const [createNew, setCreateNew] = useState(false);
  return createNew ? (
    <StyledPanelTable isEmpty={false} headers={[]}>
      <ThresholdGroupRows
        allEnvironmentNames={allEnvironmentNames}
        isLastRow
        refetch={refetch}
        setTempError={setTempError}
        project={project}
        newGroup
        onFormClose={() => setCreateNew(false)}
      />
    </StyledPanelTable>
  ) : (
    <StyledPanel>
      <StyledStrong>
        <ProjectBadge project={project} avatarSize={16} hideOverflow />
      </StyledStrong>
      <Button
        aria-label={t('Create Threshold')}
        icon={<IconAdd color="activeText" isCircled />}
        onClick={() => setCreateNew(true)}
        size="xs"
      >
        Create Threshold
      </Button>
    </StyledPanel>
  );
}

const StyledStrong = styled('strong')`
  font-size: ${p => p.theme.fontSizeMedium};
`;

const StyledPanel = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${space(2)};
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.panelBorderRadius};
  margin-top: ${space(1)};
`;

const StyledPanelTable = styled(PanelTable)`
  @media (min-width: ${p => p.theme.breakpoints.small}) {
    overflow: initial;
  }

  grid-template-columns:
    minmax(100px, 1fr) minmax(250px, 1fr) minmax(200px, 4fr)
    minmax(150px, auto);
  white-space: nowrap;
  font-size: ${p => p.theme.fontSizeMedium};
  > * {
    border-bottom: inherit;
  }
  > *:last-child {
    > *:last-child {
      border-radius: 0 0 ${p => p.theme.borderRadius} 0;
      border-bottom: 0;
    }
  }
`;
