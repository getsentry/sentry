import PropTypes from 'prop-types';
import React from 'react';
import {TransactionActivity} from '@sentry/integrations';

import getDisplayName from 'app/utils/getDisplayName';

export default function profiler() {
  return WrappedComponent => {
    const displayName = getDisplayName(WrappedComponent);

    return class extends React.Component {
      static displayName = displayName;

      static propTypes = {
        api: PropTypes.object,
      };

      componentWillUnmount() {
        this.finishProfile();
      }

      activity = TransactionActivity.pushActivity(displayName, {
        data: {},
        op: 'react',
        description: `<${displayName}>`,
      });

      finishProfile = () => {
        if (!this.activity) {
          return;
        }

        TransactionActivity.popActivity(this.activity);
        this.activity = null;
      };

      render() {
        return <WrappedComponent {...this.props} finishProfile={this.finishProfile} />;
      }
    };
  };
}
