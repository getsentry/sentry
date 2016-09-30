import React from 'react';
import SidebarPanelItem from './sidebarPanelItem';

const SidebarPanel = React.createClass({
  propTypes: {
    title: React.PropTypes.string,
    items: React.PropTypes.array,
    hidePanel: React.PropTypes.func
  },

  render() {
    return (
      <div className="sidebar-panel">
        <div className="sidebar-panel-header">
          <a className="close pull-right" onClick={this.props.hidePanel}><span className="icon-close" /></a>
          <h2>{this.props.title}</h2>
        </div>
        <div className="sidebar-panel-body">
          {!this.props.children &&
            <div className="sidebar-panel-items">
              <SidebarPanelItem />
            </div>
          }
          {this.props.children}
        </div>
      </div>
    );
  }
});

export default SidebarPanel;
