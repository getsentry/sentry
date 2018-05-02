import PropTypes from 'prop-types';
import React from 'react';
import SidebarPanelItem from './sidebarPanelItem';

class SidebarPanel extends React.Component {
  static propTypes = {
    title: PropTypes.string,
    hidePanel: PropTypes.func,
  };

  render() {
    return (
      <div className="sidebar-panel">
        <div className="sidebar-panel-header">
          <a className="close pull-right" onClick={this.props.hidePanel}>
            <span className="icon-close" />
          </a>
          <h2>{this.props.title}</h2>
        </div>
        <div className="sidebar-panel-body">
          {!this.props.children && (
            <div className="sidebar-panel-items">
              <SidebarPanelItem />
            </div>
          )}
          {this.props.children}
        </div>
      </div>
    );
  }
}

export default SidebarPanel;
