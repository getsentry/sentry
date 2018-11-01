import PropTypes from 'prop-types';
import React from 'react';
import {t} from 'app/locale';

import EmptyStateWarning from 'app/components/emptyStateWarning';

class ReleaseEmptyState extends React.Component {
  static propTypes = {
    message: PropTypes.string.isRequired,
  };

  render() {
    return (
      <EmptyStateWarning>
        <p>{this.props.message}</p>
        <p>
          <a href="https://docs.sentry.io/learn/releases/">
            {t('Learn how to integrate Release Tracking')}
          </a>
        </p>
      </EmptyStateWarning>
    );
  }
}

export default ReleaseEmptyState;
