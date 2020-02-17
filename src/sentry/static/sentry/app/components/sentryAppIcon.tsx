import PropTypes from 'prop-types';
import React from 'react';
import InlineSvg from 'app/components/inlineSvg';

type Props = {
  slug: string;
} & Omit<React.ComponentPropsWithoutRef<typeof InlineSvg>, 'src'>;

export default class SentryAppIcon extends React.Component<Props> {
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
