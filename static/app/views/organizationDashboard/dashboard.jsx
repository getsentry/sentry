import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import SentryTypes from 'app/sentryTypes';
import Widget from 'app/views/organizationDashboard/widget';
import space from 'app/styles/space';

class Dashboard extends React.Component {
  static propTypes = {
    releases: PropTypes.arrayOf(SentryTypes.Release),
    widgets: PropTypes.arrayOf(SentryTypes.Widget),
  };

  render() {
    const {releases, widgets} = this.props;

    return (
      <Widgets>
        {widgets.map((widget, i) => (
          <WidgetWrapper key={i}>
            <Widget releases={releases} widget={widget} />
          </WidgetWrapper>
        ))}
      </Widgets>
    );
  }
}
export default Dashboard;

const Widgets = styled('div')`
  display: flex;
  flex-wrap: wrap;
`;
const WidgetWrapper = styled('div')`
  width: 50%;
  :nth-child(odd) {
    padding-right: ${space(2)};
  }
`;
