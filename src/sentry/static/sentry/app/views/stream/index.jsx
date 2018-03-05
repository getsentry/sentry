import PropTypes from 'prop-types';
import React from 'react';
import createReactClass from 'create-react-class';

import withEnvironment from '../../utils/withEnvironment';
import Stream from './stream';

const StreamContainer = createReactClass({
  displayName: 'StreamContainer',
  propTypes: {
    environment: PropTypes.object,
    setProjectNavSection: PropTypes.func,
  },

  componentWillMount() {
    this.props.setProjectNavSection('stream');
  },

  render() {
    return <Stream {...this.props} />;
  },
});

export default withEnvironment(StreamContainer);
