import React from 'react';
import PureRenderMixin from 'react-addons-pure-render-mixin';
import ProjectState from '../mixins/projectState';

import AutoSelectText from './autoSelectText';

const ShortId = React.createClass({
  propTypes: {
    shortId: React.PropTypes.string,
    project: React.PropTypes.object
  },

  mixins: [
    PureRenderMixin,
    ProjectState
  ],

  preventPropagation(e) {
    // this is a hack for the stream so the click handler doesn't
    // affect this element
    e.stopPropagation();
  },

  render() {
    let shortId = this.props.shortId;
    if (!this.getFeatures().has('callsigns') || !shortId) {
      return null;
    }
    return (
      <span className="short-id" onClick={this.preventPropagation}>
        <AutoSelectText>{shortId}</AutoSelectText>
      </span>
    );
  }
});

export default ShortId;
