import React from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';

import {t} from 'app/locale';
import space from 'app/styles/space';
import Link from 'app/components/links/link';

export type StatsSubject = 'sessions' | 'users';

type Props = {
  location: Location;
  activeSubject: StatsSubject;
};

const HealthStatsSubject = ({location, activeSubject}: Props) => {
  const {pathname, query} = location;

  const subjects = [
    {
      key: 'sessions',
      label: t('Sessions'),
    },
    {
      key: 'users',
      label: t('Users'),
    },
  ];

  return (
    <Wrapper>
      {subjects.map(subject => (
        <Title
          key={subject.key}
          to={{
            pathname,
            query: {...query, healthStat: subject.key},
          }}
          selected={activeSubject === subject.key}
        >
          {subject.label}
        </Title>
      ))}
    </Wrapper>
  );
};

const Wrapper = styled('div')`
  display: grid;
  grid-auto-flow: column;
  grid-column-gap: ${space(0.75)};
  margin-right: ${space(0.25)};
`;

const Title = styled(Link)<{selected: boolean}>`
  color: ${p => (p.selected ? p.theme.gray600 : p.theme.gray500)};

  &:hover,
  &:focus {
    color: ${p => (p.selected ? p.theme.gray600 : p.theme.gray500)};
  }
`;

export default HealthStatsSubject;
