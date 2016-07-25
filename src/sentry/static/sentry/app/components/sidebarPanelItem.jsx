import React from 'react';

const SidebarPanelItem = React.createClass({
  render() {
    return (
      <div className="sidebar-panel-item">
        {this.props.title &&
          <h3>{this.props.title}</h3>
        }
        {this.props.image &&
          <div class="image"><img src={this.props.image} /></div>
        }
        {this.props.message &&
          <p className="message">{this.props.message}</p>
        }

        {this.props.link &&
          <p className="link">
            <a href={this.props.link} target="_blank">Read More</a>
          </p>
        }
      </div>
    );
  }
});

export default SidebarPanelItem;
