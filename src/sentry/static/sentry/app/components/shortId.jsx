import PropTypes from 'prop-types';
import React from 'react';
import createReactClass from 'create-react-class';
import ProjectState from '../mixins/projectState';

import AutoSelectText from './autoSelectText';

const ShortId = createReactClass({
  displayName: 'ShortId',

  propTypes: {
    shortId: PropTypes.string,
    project: PropTypes.object,
  },

  mixins: [ProjectState],

  preventPropagation(e) {
    // this is a hack for the stream so the click handler doesn't
    // affect this element
    e.stopPropagation();
  },

  render() {
    let shortId = this.props.shortId;
    if (!shortId) {
      return null;
    }
    return (
      <span className="short-id" onClick={this.preventPropagation}>
        <AutoSelectText>{shortId}</AutoSelectText>
      </span>
    );
  },
});

export default ShortId;
