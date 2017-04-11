import React from 'react';

import DropdownLink from '../components/dropdownLink';
import ListLink from '../components/listLink';
import MenuItem from '../components/menuItem';

export default React.createClass({
  propTypes: {
    setProjectNavSection: React.PropTypes.func
  },

  componentWillMount() {
    this.props.setProjectNavSection('audience');
  },

  render() {
    let {orgId, projectId} = this.props.params;
    return (
      <div style={{
          margin: '-20px -30px 0',
          overflow: 'hidden',
      }}>
        <div style={{
          padding: '10px 30px 0',
          boxShadow: '0 1px 0 rgba(0,0,0, .1)',
          position: 'relative',
          zIndex: '5'
        }}>
          <div style={{float: 'right'}}>
            <label>
              <span>Show me activity: </span>
              <DropdownLink title="In the past month">
                <MenuItem isActive={true}>In the past month</MenuItem>
              </DropdownLink>
            </label>
          </div>
          <h5 style={{float: 'left', paddingRight: 20, marginTop: 3, marginRight: 20, marginBottom: 0, borderRight: '1px solid #ddd'}}>Audience</h5>
          <ul className="nav nav-tabs" style={{float: 'left', marginBottom: '0'}}>
            <ListLink index={true} to={`/${orgId}/${projectId}/audience/`}>Overview</ListLink>
            <ListLink to={`/${orgId}/${projectId}/audience/users/`}>Users Affected</ListLink>
            <ListLink to={`/${orgId}/${projectId}/audience/feedback/`}>Feedback</ListLink>
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
  },
});
