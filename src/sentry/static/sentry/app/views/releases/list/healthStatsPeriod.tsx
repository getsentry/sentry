import React from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';

import {t} from 'app/locale';
import space from 'app/styles/space';
import Link from 'app/components/links/link';

export type StatsPeriod = '24h' | '14d';

type Props = {
  location: Location;
  activePeriod: StatsPeriod;
};

const HealthStatsPeriod = ({location, activePeriod}: Props) => {
  const {pathname, query} = location;
  const periods = [
    {
      key: '24h',
      label: t('24h'),
    },
    {
      key: '14d',
      label: t('14d'),
    },
  ];

  return (
    <Wrapper>
      {periods.map(period => (
        <Period
          key={period.key}
          to={{
            pathname,
            query: {...query, healthStatsPeriod: period.key},
          }}
          selected={activePeriod === period.key}
        >
          {period.label}
        </Period>
      ))}
    </Wrapper>
  );
};

const Wrapper = styled('div')`
  display: grid;
  grid-auto-flow: column;
  grid-column-gap: ${space(0.75)};
  flex: 1;
  justify-content: flex-end;
  text-align: right;
  margin-left: ${space(0.5)};
`;

const Period = styled(Link)<{selected: boolean}>`
  color: ${p => (p.selected ? p.theme.gray600 : p.theme.gray500)};

  &:hover,
  &:focus {
    color: ${p => (p.selected ? p.theme.gray600 : p.theme.gray500)};
  }
`;

export default HealthStatsPeriod;
