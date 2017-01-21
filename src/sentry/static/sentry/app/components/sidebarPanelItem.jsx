import React from 'react';

const SidebarPanelItem = React.createClass({
  propTypes: {
    title: React.PropTypes.string,
    image: React.PropTypes.string,
    message: React.PropTypes.any,
    link: React.PropTypes.string,
    hasSeen: React.PropTypes.bool
  },

  render() {
    let className = 'sidebar-panel-item';
    if (this.props.hasSeen) {
      className += ' has-seen';
    }

    return (
      <div className={className}>
        {this.props.title &&
          <h3>{this.props.title}</h3>
        }
        {this.props.image &&
          <div className="image"><img src={this.props.image} /></div>
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
