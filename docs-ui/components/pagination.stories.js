import React from 'react';
import PropTypes from 'prop-types';
import {withInfo} from '@storybook/addon-info';

import Pagination from 'app/components/pagination';

export default {
  title: 'Core/Pagination',
};

const withBoth = `<https://sentry.io/api/0/organizations/sentry/issues/?cursor=1603798246000:0:1>; rel="previous"; results="true"; cursor="1603798246000:0:1",
<https://sentry.io/api/0/organizations/sentry/issues/?cursor=1603719405000:0:0>; rel="next"; results="true"; cursor="1603719405000:0:0"
`;

const withNext = `<https://sentry.io/api/0/organizations/sentry/issues/?cursor=1603798246000:0:1>; rel="previous"; results="false"; cursor="1603798246000:0:1",
<https://sentry.io/api/0/organizations/sentry/issues/?cursor=1603719405000:0:0>; rel="next"; results="true"; cursor="1603719405000:0:0"
`;

class Container extends React.Component {
  static childContextTypes = {
    location: PropTypes.object,
  };

  getChildContext() {
    return {location: window.location};
  }
  render() {
    return this.props.children;
  }
}

export const Default = withInfo('Pagination')(() => {
  return (
    <Container>
      <div className="section">
        <h3>Both enabled</h3>
        <Pagination pageLinks={withBoth} />
      </div>
      <div className="section">
        <h3>Only next enabled</h3>
        <Pagination pageLinks={withNext} />
      </div>
    </Container>
  );
});

Default.story = {
  name: 'default',
};
