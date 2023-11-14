import {useMemo} from 'react';
import styled from '@emotion/styled';

import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import PanelTable from 'sentry/components/panels/panelTable';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Project} from 'sentry/types';

import {Threshold} from '../utils/types';

import {ThresholdGroupRows} from './thresholdGroupRows';

type Props = {
  allEnvironmentNames: string[];
  isError: boolean;
  isLoading: boolean;
  project: Project;
  refetch: () => void;
  setTempError: (msg: string) => void;
  thresholds: Threshold[];
};

export default function ThresholdGroupTable({
  allEnvironmentNames,
  isError,
  isLoading,
  project,
  refetch,
  setTempError,
  thresholds,
}: Props) {
  const sortedThreshold: Threshold[] = useMemo(() => {
    return thresholds.sort((a, b) => {
      const keyA: string = a.environment ? a.environment.name : '';
      const keyB: string = b.environment ? b.environment.name : '';

      return keyA.localeCompare(keyB);
    });
  }, [thresholds]);

  return (
    <div>
      <StyledStrong>
        <ProjectBadge project={project} avatarSize={16} hideOverflow />
      </StyledStrong>
      <StyledPanelTable
        isLoading={isLoading}
        isEmpty={thresholds.length === 0 && !isError}
        emptyMessage={t('No thresholds found.')}
        headers={[t('Environment'), t('Window'), t('Condition'), t(' ')]}
      >
        {sortedThreshold &&
          sortedThreshold.map((threshold, idx) => {
            return (
              <ThresholdGroupRows
                key={threshold.id}
                project={project}
                allEnvironmentNames={allEnvironmentNames}
                threshold={threshold}
                refetch={refetch}
                setTempError={setTempError}
                isLastRow={idx === sortedThreshold.length - 1}
              />
            );
          })}
      </StyledPanelTable>
    </div>
  );
}

const StyledStrong = styled('div')`
  font-weight: 600;
  font-size: ${p => p.theme.fontSizeMedium};
  margin: ${space(2)} 0;
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
