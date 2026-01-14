import styled from '@emotion/styled';

import {Tooltip} from 'sentry/components/core/tooltip';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import {ReleasesSortOption} from 'sentry/constants/releases';
import {t} from 'sentry/locale';
import ReleasesSelectControl from 'sentry/views/dashboards/releasesSelectControl';

function WidgetBuilderFilterBar({releases}: {releases: string[]}) {
  return (
    <Tooltip
      title={t('Changes to these filters can only be made at the dashboard level')}
      skipWrapper
    >
      <StyledPageFilterBar>
        <ProjectPageFilter disabled />
        <EnvironmentPageFilter disabled />
        <DatePageFilter disabled />
        <ReleasesSelectControl
          isDisabled
          id="releases-select-control"
          selectedReleases={releases}
          sortBy={ReleasesSortOption.DATE}
        />
      </StyledPageFilterBar>
    </Tooltip>
  );
}

export default WidgetBuilderFilterBar;

// Override the styles of the trigger button of the releases selection
// control. This is because filter buttons are
// translated back to slightly overlap the border, which causes
// the last button not to extend the full width
const StyledPageFilterBar = styled(PageFilterBar)`
  #releases-select-control button {
    min-width: calc(100% + 3px);
  }
`;
