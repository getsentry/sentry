import React from 'react';

const HoverCard = React.createClass({
  propTypes: {
    version: React.PropTypes.string.isRequired,
    orgId: React.PropTypes.string.isRequired,
    projectId: React.PropTypes.string.isRequired
  },

  render() {
    let {orgId, projectId, version} = this.props;
    let shortVersion = version.match(/^[a-f0-9]{40}$/) ? version.substr(0, 12) : version;

    return (
      <div className="hovercard">
        <div className="hovercard-header">
          <div className="pull-right">
            <a href="#"><span className="icon icon-open" /></a>
          </div>
          <span>Release {shortVersion}</span>
        </div>
        <div className="hovercard-body">
          <div className="row row-flex">
            <div className="col-xs-4">
              <h6>New Issues</h6>
              <div className="count">23</div>
            </div>
            <div className="col-xs-8">
              <h6>18 commits by 3 authors</h6>
              <div className="avatar-grid">
                [Avatar grid]
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
});

export default HoverCard;
