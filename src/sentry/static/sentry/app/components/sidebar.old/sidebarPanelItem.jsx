import PropTypes from 'prop-types';
import React from 'react';
import {t} from 'app/locale';

class SidebarPanelItem extends React.Component {
  static propTypes = {
    title: PropTypes.string,
    image: PropTypes.string,
    message: PropTypes.any,
    link: PropTypes.string,
    hasSeen: PropTypes.bool,
  };

  render() {
    let className = 'sidebar-panel-item';
    if (this.props.hasSeen) {
      className += ' has-seen';
    }

    return (
      <div className={className}>
        {this.props.title && <h3>{this.props.title}</h3>}
        {this.props.image && (
          <div className="image">
            <img src={this.props.image} />
          </div>
        )}
        {this.props.message && <p className="message">{this.props.message}</p>}

        {this.props.link && (
          <p className="link">
            <a href={this.props.link} target="_blank">
              {t('Read More')}
            </a>
          </p>
        )}
      </div>
    );
  }
}

export default SidebarPanelItem;
