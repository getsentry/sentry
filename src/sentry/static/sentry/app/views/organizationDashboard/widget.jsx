import {withRouter} from 'react-router';
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import {Panel, PanelBody, PanelHeader} from 'app/components/panels';
import {WIDGET_DISPLAY} from 'app/views/organizationDashboard/constants';
import {getChartComponent} from 'app/views/organizationDashboard/utils/getChartComponent';
import {getData} from 'app/views/organizationDashboard/utils/getData';
import {getQueryStringFromQuery} from 'app/views/organizationDiscover/utils';
import Button from 'app/components/button';
import ReleaseSeries from 'app/components/charts/releaseSeries';
import InlineSvg from 'app/components/inlineSvg';
import SentryTypes from 'app/sentryTypes';
import withGlobalSelection from 'app/utils/withGlobalSelection';
import withOrganization from 'app/utils/withOrganization';

import DiscoverQuery from './discoverQuery';

class Widget extends React.Component {
  static propTypes = {
    releases: PropTypes.arrayOf(SentryTypes.Release),
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

  renderResults(results) {
    const {releases, widget} = this.props;
    const isTable = widget.type === WIDGET_DISPLAY.TABLE;

    // get visualization based on widget data
    const ChartComponent = getChartComponent(widget);
    // get data func based on query
    const chartData = getData(results, widget);

    const extra = {
      ...(isTable && {
        headerProps: {hasButtons: true},
        extraTitle: this.renderDiscoverButton(),
      }),
    };

    if (widget.includeReleases) {
      return (
        <ReleaseSeries releases={releases}>
          {({releaseSeries}) => (
            <ChartComponent
              {...chartData}
              {...extra}
              series={[...chartData.series, ...releaseSeries]}
            />
          )}
        </ReleaseSeries>
      );
    }

    return <ChartComponent {...chartData} {...extra} />;
  }

  renderDiscoverButton() {
    // TODO(billy): This is temporary
    // Need design followups
    return (
      <Button size="xsmall" onClick={this.handleExportToDiscover}>
        <InlineSvg src="icon-discover" />
      </Button>
    );
  }

  render() {
    const {widget} = this.props;
    const {type, title, includePreviousPeriod, compareToPeriod, queries} = widget;
    const isTable = type === WIDGET_DISPLAY.TABLE;

    return (
      <DiscoverQuery
        queries={queries.discover}
        includePreviousPeriod={includePreviousPeriod}
        compareToPeriod={compareToPeriod}
      >
        {({results}) => {
          if (!results) {
            return <Placeholder />;
          }

          if (isTable) {
            return this.renderResults(results);
          }

          return (
            <Panel>
              <StyledPanelHeader hasButtons>
                {title}

                {this.renderDiscoverButton()}
              </StyledPanelHeader>

              <StyledPanelBody>{this.renderResults(results)}</StyledPanelBody>
            </Panel>
          );
        }}
      </DiscoverQuery>
    );
  }
}
export default withRouter(withOrganization(withGlobalSelection(Widget)));
export {Widget};

// XXX Heights between panel headers with `hasButtons` are not equal :(
const StyledPanelHeader = styled(PanelHeader)`
  height: 46px;
`;

const StyledPanelBody = styled(PanelBody)`
  height: 200px;
`;

const Placeholder = styled('div')`
  background-color: ${p => p.theme.offWhite};
  height: 248px;
`;
