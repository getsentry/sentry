import React from 'react';
import PureRenderMixin from 'react-addons-pure-render-mixin';
import ProjectState from '../mixins/projectState';

const ShortId = React.createClass({
  propTypes: {
    shortId: React.PropTypes.string,
    project: React.PropTypes.object
  },

  mixins: [
    PureRenderMixin,
    ProjectState
  ],

  render() {
    let shortId = this.props.shortId;
    let project = this.props.project || this.getProject();

    if (!this.getFeatures().has('callsigns') || !shortId) {
      return null;
    }
    return (
      <span className="short-id" style={{
        color: project.color
      }}>{shortId}</span>
    );
  }
});

export default ShortId;
