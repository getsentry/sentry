import React from 'react';
import styled, {css} from 'react-emotion';

import {getDiscoverUrlPathFromDiscoverQuery} from 'app/views/organizationDashboard/utils/getDiscoverUrlPathFromDiscoverQuery';
import {getEventsUrlPathFromDiscoverQuery} from 'app/views/organizationDashboard/utils/getEventsUrlPathFromDiscoverQuery';
import {t} from 'app/locale';
import Button from 'app/components/button';
import DropdownLink from 'app/components/dropdownLink';
import InlineSvg from 'app/components/inlineSvg';
import SentryTypes from 'app/sentryTypes';
import space from 'app/styles/space';
import withOrganization from 'app/utils/withOrganization';

const exploreMenuCss = css`
  font-weight: normal;
  text-transform: none;
  white-space: nowrap;
`;

class ExploreWidget extends React.Component {
  static propTypes = {
    widget: SentryTypes.Widget,
    organization: SentryTypes.Organization,
    selection: SentryTypes.GlobalSelection,
  };

  getExportToDiscover = query => {
    const {selection, organization} = this.props;
    return getDiscoverUrlPathFromDiscoverQuery({
      organization,
      selection,
      query,
    });
  };

  getExportToEvents = query => {
    const {selection, organization} = this.props;
    return getEventsUrlPathFromDiscoverQuery({
      organization,
      selection,
      query,
    });
  };

  render() {
    const {widget} = this.props;
    const discoverQueries = widget.queries.discover;

    return (
      <DropdownLink
        anchorRight={true}
        title={t('Explore')}
        topLevelClasses={exploreMenuCss}
      >
        {discoverQueries.map(query => (
          <ExploreRow key={query.name}>
            <QueryName>{query.name}</QueryName>

            <ExploreActions>
              <Button borderless size="zero" to={this.getExportToDiscover(query)}>
                <InlineSvg src="icon-discover" />
              </Button>
              <Button borderless size="zero" to={this.getExportToEvents(query)}>
                <InlineSvg src="icon-stack" />
              </Button>
            </ExploreActions>
          </ExploreRow>
        ))}
      </DropdownLink>
    );
  }
}
export default withOrganization(ExploreWidget);

const ExploreRow = styled('li')`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 ${space(0.5)};
`;

const ExploreActions = styled('div')`
  display: flex;
`;

const QueryName = styled('span')`
  margin-right: ${space(1)};
`;
