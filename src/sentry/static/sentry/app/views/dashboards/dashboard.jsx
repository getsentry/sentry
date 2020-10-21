import PropTypes from 'prop-types';
import {Component} from 'react';
import styled from '@emotion/styled';

import SentryTypes from 'app/sentryTypes';
import space from 'app/styles/space';

import Widget from './widget';

class Dashboard extends Component {
  static propTypes = {
    releasesLoading: PropTypes.bool,
    releases: PropTypes.arrayOf(SentryTypes.Release),
    widgets: PropTypes.arrayOf(SentryTypes.Widget),
    router: PropTypes.object,
  };

  render() {
    const {releasesLoading, router, releases, widgets} = this.props;

    return (
      <Widgets>
        {widgets.map((widget, i) => (
          <WidgetWrapper key={i}>
            <Widget
              releasesLoading={releasesLoading}
              releases={releases}
              widget={widget}
              router={router}
            />
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
