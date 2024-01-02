import {useState} from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';
import debounce from 'lodash/debounce';

import {CompactSelect, SelectOption} from 'sentry/components/compactSelect';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {DEFAULT_DEBOUNCE_DURATION} from 'sentry/constants';
import {IconReleases} from 'sentry/icons/iconReleases';
import {t, tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {defined} from 'sentry/utils';
import {getFormattedDate} from 'sentry/utils/dates';
import {useLocation} from 'sentry/utils/useLocation';
import {
  useReleases,
  useReleaseSelection,
} from 'sentry/views/starfish/queries/useReleases';
import {formatVersionAndCenterTruncate} from 'sentry/views/starfish/utils/centerTruncate';

type Props = {
  selectorKey: string;
  selectorName?: string;
  selectorValue?: string;
};

export function ReleaseSelector({selectorKey, selectorValue}: Props) {
  const [searchTerm, setSearchTerm] = useState<string | undefined>(undefined);
  const {data, isLoading} = useReleases(searchTerm);
  const {primaryRelease, secondaryRelease} = useReleaseSelection();
  const location = useLocation();

  const options: SelectOption<string>[] = [];
  if (defined(selectorValue)) {
    const index = data?.findIndex(({version}) => version === selectorValue);
    const selectedRelease = defined(index) ? data?.[index] : undefined;
    let selectedReleaseSessionCount: number | undefined = undefined;
    let selectedReleaseDateCreated: string | undefined = undefined;
    if (defined(selectedRelease)) {
      selectedReleaseSessionCount = selectedRelease.count;
      selectedReleaseDateCreated = selectedRelease.dateCreated;
    }

    options.push({
      value: selectorValue,
      label: selectorValue,
      details: (
        <LabelDetails
          screenCount={selectedReleaseSessionCount}
          dateCreated={selectedReleaseDateCreated}
        />
      ),
    });
  }
  data
    ?.filter(({version}) => ![primaryRelease, secondaryRelease].includes(version))
    .forEach(release => {
      const option = {
        value: release.version,
        label: release.version,
        details: (
          <LabelDetails screenCount={release.count} dateCreated={release.dateCreated} />
        ),
      };
      options.push(option);
    });

  return (
    <StyledCompactSelect
      triggerProps={{
        icon: <IconReleases />,
        title: selectorValue,
      }}
      triggerLabel={
        selectorValue ? formatVersionAndCenterTruncate(selectorValue, 16) : selectorValue
      }
      menuTitle={t('Filter Release')}
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
  dateCreated?: string;
  screenCount?: number;
};

function LabelDetails(props: LabelDetailsProps) {
  return (
    <DetailsContainer>
      <div>
        {defined(props.screenCount)
          ? tn('%s event', '%s events', props.screenCount)
          : t('No screens')}
      </div>
      <div>
        {defined(props.dateCreated)
          ? getFormattedDate(props.dateCreated, 'MMM D, YYYY')
          : null}
      </div>
    </DetailsContainer>
  );
}

export function ReleaseComparisonSelector() {
  const {primaryRelease, secondaryRelease} = useReleaseSelection();
  return (
    <StyledPageSelector condensed>
      <ReleaseSelector
        selectorKey="primaryRelease"
        selectorValue={primaryRelease}
        selectorName={t('Release 1')}
        key="primaryRelease"
      />
      <ReleaseSelector
        selectorKey="secondaryRelease"
        selectorName={t('Release 2')}
        selectorValue={secondaryRelease}
        key="secondaryRelease"
      />
    </StyledPageSelector>
  );
}

const StyledCompactSelect = styled(CompactSelect)`
  @media (min-width: ${p => p.theme.breakpoints.medium}) {
    max-width: 275px;
  }
`;

const StyledPageSelector = styled(PageFilterBar)`
  & > * {
    min-width: 135px;
    &:last-child {
      min-width: 135px;
    }
  }
`;

const DetailsContainer = styled('div')`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  gap: ${space(1)};
  min-width: 200px;
`;
