import styled from '@emotion/styled';
import type {Location} from 'history';

import {Link} from '@sentry/scraps/link';

import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {t} from 'sentry/locale';
import {HealthStatsPeriodOption} from 'sentry/types/release';
import {
  applyQueryParamsUpdates,
  loadQueryParamsFromLocation,
  parseAsScalar,
} from 'sentry/views/explore/queryParams/parsers';

const healthStatsPeriodParsers = {
  healthStatsPeriod: parseAsScalar.withDefault(HealthStatsPeriodOption.AUTO),
};

type Props = {
  location: Location;
};

export function ReleaseCardStatsPeriod({location}: Props) {
  const {selection} = usePageFilters();
  const {healthStatsPeriod: activePeriod} = loadQueryParamsFromLocation(
    healthStatsPeriodParsers,
    location
  );
  const getPeriodTarget = (healthStatsPeriod: HealthStatsPeriodOption) => ({
    pathname: location.pathname,
    query: applyQueryParamsUpdates(healthStatsPeriodParsers, location, {
      healthStatsPeriod,
    }).query,
  });

  return (
    <Wrapper>
      {/* don't show duplicate 24h options */}
      {selection.datetime.period !== HealthStatsPeriodOption.TWENTY_FOUR_HOURS && (
        <Period
          to={getPeriodTarget(HealthStatsPeriodOption.TWENTY_FOUR_HOURS)}
          selected={activePeriod === HealthStatsPeriodOption.TWENTY_FOUR_HOURS}
        >
          {t('24h')}
        </Period>
      )}

      <Period
        to={getPeriodTarget(HealthStatsPeriodOption.AUTO)}
        selected={activePeriod === HealthStatsPeriodOption.AUTO}
      >
        {selection.datetime.start ? t('Custom') : (selection.datetime.period ?? t('14d'))}
      </Period>
    </Wrapper>
  );
}

const Wrapper = styled('div')`
  display: grid;
  grid-auto-flow: column;
  grid-column-gap: ${p => p.theme.space.sm};
  flex: 1;
  justify-content: flex-end;
  text-align: right;
  margin-left: ${p => p.theme.space.xs};
`;

const Period = styled(Link)<{selected: boolean}>`
  color: ${p =>
    p.selected ? p.theme.tokens.content.primary : p.theme.tokens.content.secondary};

  &:hover,
  &:focus {
    color: ${p =>
      p.selected ? p.theme.tokens.content.primary : p.theme.tokens.content.secondary};
  }
`;
