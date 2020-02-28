import PropTypes from 'prop-types';
import React from 'react';
import {Integrations} from '@sentry/apm';

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

      activity = Integrations.Tracing.pushActivity(
        displayName,
        {
          data: {},
          op: 'react',
          description: `<${displayName}>`,
        },
        {
          autoPopAfter: 500, // After this timeout we'll pop this activity regardless
        }
      );
      // For whatever reason it's not guaranteed that `finishProfile` will be called, that's why we need
      // the previously described timeout to make sure our transaction will be finished.

      finishProfile = () => {
        if (!this.activity) {
          return;
        }

        Integrations.Tracing.popActivity(this.activity);
        this.activity = null;
      };

      render() {
        return <WrappedComponent {...this.props} finishProfile={this.finishProfile} />;
      }
    };
  };
}
