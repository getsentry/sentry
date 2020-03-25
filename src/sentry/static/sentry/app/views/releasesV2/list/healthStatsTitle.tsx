import React from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';

import {t} from 'app/locale';
import space from 'app/styles/space';
import {IconSliders} from 'app/icons';
import Link from 'app/components/links/link';
import Tooltip from 'app/components/tooltip';

export type StatsSubject = 'sessions' | 'users';

type Props = {
  location: Location;
  activeSubject: StatsSubject;
};

const HealthStatsTitle = ({location, activeSubject}: Props) => {
  const {pathname, query} = location;

  const subjects = {
    sessions: {
      label: t('Daily Sessions'),
      switchTo: 'users',
      switchToLabel: t('Switch to Daily Users'),
    },
    users: {
      label: t('Daily Users'),
      switchTo: 'sessions',
      switchToLabel: t('Switch to Daily Sessions'),
    },
  };

  return (
    <React.Fragment>
      <SwitchHealthSubject
        to={{pathname, query: {...query, healthStat: subjects[activeSubject].switchTo}}}
      >
        <Tooltip title={subjects[activeSubject].switchToLabel}>
          <IconSliders size="xs" />
        </Tooltip>
      </SwitchHealthSubject>
      {subjects[activeSubject].label}:
    </React.Fragment>
  );
};

const SwitchHealthSubject = styled(Link)`
  position: relative;
  top: ${space(0.25)};
  color: ${p => p.theme.gray2};
  margin-right: ${space(1)};
  &:hover,
  &:focus {
    color: ${p => p.theme.gray2};
  }
`;

export default HealthStatsTitle;
