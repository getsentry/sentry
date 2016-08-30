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
      <div className="sidebar-panel" data-top={this.props.top}>
        <div className="sidebar-panel-header">
          <a className="close pull-right" onClick={this.props.hidePanel}><span className="icon-x" /></a>
          <h2>{this.props.title}</h2>
        </div>
        {!this.props.children &&
          <div className="sidebar-panel-items">
            <SidebarPanelItem />
          </div>
        }
        {this.props.children &&
          this.props.children
        }
      </div>
    );
  }
});

export default SidebarPanel;
