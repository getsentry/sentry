import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import {t} from 'app/locale';
import AsyncView from 'app/views/asyncView';
import SentryTypes from 'app/sentryTypes';
import space from 'app/styles/space';

class Dashboard extends AsyncView {
  static propTypes = {
    widgets: PropTypes.arrayOf(SentryTypes.Widget),
  };

  getTitle() {
    return t('Dashboard');
  }

  getEndpoints() {
    return [];
  }

  render() {
    const {widgets} = this.props;

    return (
      <Widgets>
        {widgets.map((widget, i) => (
          <WidgetWrapper key={i}>
            <div />
          </WidgetWrapper>
        ))}
      </Widgets>
    );
  }
}
export default Dashboard;
export {Dashboard};

const Widgets = styled('div')`
  display: flex;
  flex-wrap: wrap;
`;
const WidgetWrapper = styled('div')`
  width: 50%;
  padding: ${space(1)};
`;
