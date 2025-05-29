import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {Tooltip} from 'sentry/components/core/tooltip';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import {DEFAULT_STATS_PERIOD} from 'sentry/constants';
import {t} from 'sentry/locale';
import {ReleasesProvider} from 'sentry/utils/releases/releasesProvider';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import ReleasesSelectControl from 'sentry/views/dashboards/releasesSelectControl';

function WidgetBuilderFilterBar({releases}: {releases: string[]}) {
  const organization = useOrganization();
  const {selection} = usePageFilters();
  return (
    <PageFiltersContainer
      skipLoadLastUsed
      skipInitializeUrlParams
      disablePersistence
      defaultSelection={{
        datetime: {
          start: null,
          end: null,
          utc: false,
          period: DEFAULT_STATS_PERIOD,
        },
      }}
    >
      <Tooltip
        title={t('Changes to these filters can only be made at the dashboard level')}
        skipWrapper
      >
        <StyledPageFilterBar>
          <ProjectPageFilter disabled onChange={() => {}} />
          <EnvironmentPageFilter disabled onChange={() => {}} />
          <DatePageFilter disabled onChange={() => {}} />
          <ReleasesProvider organization={organization} selection={selection}>
            <ReleasesSelectControl
              isDisabled
              id="releases-select-control"
              handleChangeFilter={() => {}}
              selectedReleases={releases}
            />
          </ReleasesProvider>
        </StyledPageFilterBar>
      </Tooltip>
    </PageFiltersContainer>
  );
}

export default WidgetBuilderFilterBar;

// Override the styles of the trigger button of the releases selection
// control under the chonk UI. This is because filter buttons are
// translated back to slightly overlap the border, which causes
// the last button not to extend the full width
const StyledPageFilterBar = styled(PageFilterBar)`
  ${p =>
    p.theme.isChonk &&
    css`
      #releases-select-control button {
        min-width: calc(100% + 3px);
      }
    `}
`;
