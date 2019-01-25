import PropTypes from 'prop-types';
import React from 'react';
import styled, {css} from 'react-emotion';

import {getEventsUrlPathFromDiscoverQuery} from 'app/views/organizationDashboard/utils/getEventsUrlPathFromDiscoverQuery';
import {getQueryStringFromQuery} from 'app/views/organizationDiscover/utils';
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
    queries: PropTypes.arrayOf(SentryTypes.DiscoverQuery),
    organization: SentryTypes.Organization,
    selection: SentryTypes.GlobalSelection,
    router: PropTypes.object,
  };

  getExportToDiscover = query => {
    const {organization} = this.props;
    const {
      datetime,
      environments, // eslint-disable-line no-unused-vars
      ...selection
    } = this.props.selection;

    // Discover does not support importing these
    const {
      groupby, // eslint-disable-line no-unused-vars
      rollup, // eslint-disable-line no-unused-vars
      orderby,
      ...restQuery
    } = query;

    const orderbyTimeIndex = orderby.indexOf('time');
    let visual = 'table';

    if (orderbyTimeIndex !== -1) {
      restQuery.orderby = `${orderbyTimeIndex === 0 ? '' : '-'}${restQuery
        .aggregations[0][2]}`;
      visual = 'line-by-day';
    } else {
      restQuery.orderby = orderby;
    }

    return `/organizations/${organization.slug}/discover/${getQueryStringFromQuery({
      ...restQuery,
      ...selection,
      start: datetime.start,
      end: datetime.end,
      range: datetime.period,
      limit: 1000,
    })}&visual=${visual}`;
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
