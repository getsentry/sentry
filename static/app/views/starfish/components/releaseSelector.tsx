import {useState} from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';
import debounce from 'lodash/debounce';

import {CompactSelect, SelectOption} from 'sentry/components/compactSelect';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {DEFAULT_DEBOUNCE_DURATION} from 'sentry/constants';
import {t, tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {defined} from 'sentry/utils';
import {useLocation} from 'sentry/utils/useLocation';
import {
  useReleases,
  useReleaseSelection,
  useReleaseStats,
} from 'sentry/views/starfish/queries/useReleases';

type Props = {
  selectorKey: string;
  selectorName?: string;
  selectorValue?: string;
};

export function ReleaseSelector({selectorName, selectorKey, selectorValue}: Props) {
  const [searchTerm, setSearchTerm] = useState<string | undefined>(undefined);
  const {data, isLoading} = useReleases(searchTerm);
  const {data: releaseStats} = useReleaseStats();
  const location = useLocation();

  const options: SelectOption<string>[] = [];
  if (defined(selectorValue)) {
    options.push({
      value: selectorValue,
      label: selectorValue,
    });
  }
  data
    ?.filter(({version}) => selectorValue !== version)
    .forEach(release => {
      const option = {
        value: release.version,
        label: release.version,
        details: (
          <LabelDetails sessionCount={releaseStats[release.version]?.['sum(session)']} />
        ),
      };

      options.push(option);
    });

  return (
    <StyledCompactSelect
      triggerProps={{
        prefix: selectorName,
        title: selectorValue,
      }}
      loading={isLoading}
      searchable
      value={selectorValue}
      options={[
        {
          value: '_releases',
          label: t('Sorted by date created'),
          options,
        },
      ]}
      onSearch={debounce(val => {
        setSearchTerm(val);
      }, DEFAULT_DEBOUNCE_DURATION)}
      onChange={newValue => {
        browserHistory.push({
          ...location,
          query: {
            ...location.query,
            [selectorKey]: newValue.value,
          },
        });
      }}
      onClose={() => {
        setSearchTerm(undefined);
      }}
    />
  );
}

type LabelDetailsProps = {
  sessionCount?: number;
};

function LabelDetails(props: LabelDetailsProps) {
  return (
    <DetailsContainer>
      <div>
        {defined(props.sessionCount)
          ? tn('%s session', '%s sessions', props.sessionCount)
          : '-'}
      </div>
    </DetailsContainer>
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

const DetailsContainer = styled('div')`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  gap: ${space(1)};
`;
