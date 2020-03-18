import React from 'react';
import PropTypes from 'prop-types';

import {IconClickup, IconClubhouse, IconRookout, IconGeneric} from 'app/icons';

type Props = {
  slug: string;
};

export default class SentryAppIcon extends React.Component<Props> {
  static propTypes = {
    slug: PropTypes.string.isRequired,
  };

  render() {
    switch (this.props.slug) {
      case 'clickup':
        return <IconClickup size="md" />;
      case 'clubhouse':
        return <IconClubhouse size="md" />;
      case 'rookout':
        return <IconRookout size="md" />;
      default:
        return <IconGeneric size="md" />;
    }
  }
}
