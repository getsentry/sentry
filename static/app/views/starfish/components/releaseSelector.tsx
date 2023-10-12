import {browserHistory} from 'react-router';
import styled from '@emotion/styled';

import {CompactSelect} from 'sentry/components/compactSelect';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {t} from 'sentry/locale';
import {defined} from 'sentry/utils';
import {useLocation} from 'sentry/utils/useLocation';
import {
  useReleases,
  useReleaseSelection,
} from 'sentry/views/starfish/queries/useReleases';

const ALL_RELEASES = {
  value: '',
  label: t('All Releases'),
};

type Props = {
  selectorKey: string;
  selectorName?: string;
  selectorValue?: string;
};

export function ReleaseSelector({selectorName, selectorKey, selectorValue}: Props) {
  const {data, isLoading} = useReleases();
  const location = useLocation();
  let value = selectorValue;

  if (!isLoading && !defined(value)) {
    value = ALL_RELEASES.value;
  }
  return (
    <StyledCompactSelect
      triggerProps={{
        prefix: selectorName,
      }}
      value={selectorValue}
      options={[
        ...(data ?? [ALL_RELEASES]).map(release => ({
          value: release.version,
          label: release.shortVersion ?? release.version,
        })),
      ]}
      onChange={newValue => {
        browserHistory.push({
          ...location,
          query: {
            ...location.query,
            [selectorKey]: newValue.value,
          },
        });
      }}
    />
  );
}

export function ReleaseComparisonSelector() {
  const {primaryRelease, secondaryRelease} = useReleaseSelection();
  return (
    <PageFilterBar condensed>
      <ReleaseSelector selectorKey="primaryRelease" selectorValue={primaryRelease} />
      <ReleaseSelector
        selectorKey="secondaryRelease"
        selectorName={t('Compared To')}
        selectorValue={secondaryRelease}
      />
    </PageFilterBar>
  );
}

const StyledCompactSelect = styled(CompactSelect)`
  @media (min-width: ${p => p.theme.breakpoints.medium}) {
    max-width: 275px;
  }
`;
