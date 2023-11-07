import {useMemo} from 'react';
import styled from '@emotion/styled';

import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import PanelTable from 'sentry/components/panels/panelTable';
import {t} from 'sentry/locale';

import {Threshold} from '../utils/types';

import {ThresholdGroupRows} from './thresholdGroupRows';

type Props = {
  isError: boolean;
  isLoading: boolean;
  refetch: () => void;
  setTempError: (msg: string) => void;
  thresholds: Threshold[];
};

export function ThresholdGroupTable({
  isError,
  isLoading,
  refetch,
  setTempError,
  thresholds,
}: Props) {
  const project = thresholds[0]?.project;
  const thresholdsByEnv: {[key: string]: Threshold[]} = useMemo(() => {
    const byEnv = {};
    thresholds.forEach(threshold => {
      const env = threshold.environment ? threshold.environment.name : '';
      if (!byEnv[env]) {
        byEnv[env] = [];
      }
      byEnv[env].push(threshold);
    });
    return byEnv;
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
        {thresholdsByEnv &&
          Object.entries(thresholdsByEnv).map(([envName, thresholdGroup]) => (
            <ThresholdGroupRows
              key={`${envName}`}
              thresholds={thresholdGroup}
              refetch={refetch}
              setError={setTempError}
            />
          ))}
      </StyledPanelTable>
    </div>
  );
}

const StyledStrong = styled('strong')`
  font-size: ${p => p.theme.fontSizeMedium};
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
