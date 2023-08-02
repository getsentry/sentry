import {browserHistory} from 'react-router';
import styled from '@emotion/styled';

import {CompactSelect} from 'sentry/components/compactSelect';
import {t} from 'sentry/locale';
import {defined} from 'sentry/utils';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import {useReleases} from 'sentry/views/starfish/queries/useReleases';

const ALL_RELEASES = {
  value: '',
  label: t('All Releases'),
};

type Props = {
  selectorKey: string;
  selectorName: string;
};

export function ReleaseSelector({selectorName, selectorKey}: Props) {
  const {data, isLoading} = useReleases();
  const location = useLocation();
  let value =
    decodeScalar(location.query[selectorKey]) ?? data?.[0]?.version ?? undefined;

  if (!isLoading && !defined(value)) {
    value = ALL_RELEASES.value;
  }
  return (
    <StyledCompactSelect
      triggerProps={{
        prefix: selectorName,
      }}
      value={value}
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

const StyledCompactSelect = styled(CompactSelect)`
  @media (min-width: ${p => p.theme.breakpoints.small}) {
    max-width: 300px;
  }
`;
