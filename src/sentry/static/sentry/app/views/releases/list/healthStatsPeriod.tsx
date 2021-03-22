import React from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';

import Link from 'app/components/links/link';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {GlobalSelection} from 'app/types';
import withGlobalSelection from 'app/utils/withGlobalSelection';

type Props = {
  location: Location;
  selection: GlobalSelection;
};

const HealthStatsPeriod = ({location, selection}: Props) => {
  const activePeriod = location.query.healthStatsPeriod || '24h';
  const {pathname, query} = location;

  return (
    <Wrapper>
      {selection.datetime.period !== '24h' && (
        <Period
          to={{
            pathname,
            query: {...query, healthStatsPeriod: '24h'},
          }}
          selected={activePeriod === '24h'}
        >
          {t('24h')}
        </Period>
      )}

      <Period
        to={{
          pathname,
          query: {...query, healthStatsPeriod: 'auto'},
        }}
        selected={activePeriod === 'auto'}
      >
        {selection.datetime.start ? t('Custom') : selection.datetime.period ?? t('14d')}
      </Period>
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
  color: ${p => (p.selected ? p.theme.gray400 : p.theme.gray300)};

  &:hover,
  &:focus {
    color: ${p => (p.selected ? p.theme.gray400 : p.theme.gray300)};
  }
`;

export default withGlobalSelection(HealthStatsPeriod);
