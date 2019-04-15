import PropTypes from 'prop-types';
import React from 'react';
import InlineSvg from 'app/components/inlineSvg';

export default class SentryAppIcon extends React.Component {
  static propTypes = {
    slug: PropTypes.string.isRequired,
  };

  iconExists() {
    try {
      require(`../icons/icon-${this.props.slug}.svg`);
      return true;
    } catch (err) {
      return false;
    }
  }

  render() {
    let icon = 'icon-generic-box';
    if (this.iconExists()) {
      icon = `icon-${this.props.slug}`;
    }
    return <InlineSvg {...this.props} src={icon} />;
  }
}
