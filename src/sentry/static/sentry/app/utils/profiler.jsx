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

      activity = Integrations.Tracing.pushActivity(displayName, {
        data: {},
        op: 'react',
        description: `<${displayName}>`,
      });

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
