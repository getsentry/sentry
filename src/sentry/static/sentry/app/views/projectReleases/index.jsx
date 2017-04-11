import React from 'react';

import ListLink from '../../components/listLink';

export default React.createClass({
  propTypes: {
    setProjectNavSection: React.PropTypes.func
  },

  componentWillMount() {
    this.props.setProjectNavSection('releases');
  },

  render() {
    let {orgId, projectId} = this.props.params;
    return (
      <div style={{
          margin: '-20px -30px 0',
          overflow: 'hidden',
      }}>
        <div style={{
          padding: '20px 30px 0',
          borderBottom: '1px solid #ddd',
        }}>
          <h4 style={{float: 'left', paddingRight: 20, marginRight: 20, borderRight: '1px solid #ddd'}}>Releases</h4>
          <ul className="nav nav-tabs" style={{float: 'left'}}>
            <ListLink index={true} to={`/${orgId}/${projectId}/releases/`}>Overview</ListLink>
            <ListLink to={`/${orgId}/${projectId}/releases/versions/`}>Versions</ListLink>
          </ul>
          <div className="clearfix" />
        </div>
        <div style={{
          padding: '20px 30px 0',
        }}>
          {this.props.children}
        </div>
      </div>
    );
  }
});
