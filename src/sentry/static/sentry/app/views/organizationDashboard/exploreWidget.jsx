import PropTypes from 'prop-types';
import React from 'react';

import {getQueryStringFromQuery} from 'app/views/organizationDiscover/utils';
import Button from 'app/components/button';
import InlineSvg from 'app/components/inlineSvg';
import SentryTypes from 'app/sentryTypes';
import withOrganization from 'app/utils/withOrganization';

class ExploreWidget extends React.Component {
  static propTypes = {
    widget: SentryTypes.Widget,
    organization: SentryTypes.Organization,
    selection: SentryTypes.GlobalSelection,
    router: PropTypes.object,
  };

  handleExportToDiscover = event => {
    const {organization, widget, router} = this.props;
    const [firstQuery] = widget.queries.discover;
    const {
      datetime,
      environments, // eslint-disable-line no-unused-vars
      ...selection
    } = this.props.selection;

    event.stopPropagation();

    // Discover does not support importing these
    const {
      groupby, // eslint-disable-line no-unused-vars
      rollup, // eslint-disable-line no-unused-vars
      orderby,
      ...query
    } = firstQuery;

    const orderbyTimeIndex = orderby.indexOf('time');
    let visual = 'table';

    if (orderbyTimeIndex !== -1) {
      query.orderby = `${orderbyTimeIndex === 0 ? '' : '-'}${query.aggregations[0][2]}`;
      visual = 'line-by-day';
    } else {
      query.orderby = orderby;
    }

    router.push(
      `/organizations/${organization.slug}/discover/${getQueryStringFromQuery({
        ...query,
        ...selection,
        start: datetime.start,
        end: datetime.end,
        range: datetime.period,
        limit: 1000,
      })}&visual=${visual}`
    );
  };

  render() {
    // TODO(billy): This is temporary
    // Need design followups
    return (
      <Button size="xsmall" onClick={this.handleExportToDiscover}>
        <InlineSvg src="icon-discover" />
      </Button>
    );
  }
}
export default withOrganization(ExploreWidget);
