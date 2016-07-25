import React from 'react';

const SidebarPanelItem = React.createClass({
  render() {
    return (
      <div className="sidebar-panel-item">
        <h3>Type Error <span className="culprit">poll(../../sentry/scripts/views.js)</span></h3>
        <div className="message">Object [object Object] has no method 'updateFrom'</div>
      </div>
    );
  }
});

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
