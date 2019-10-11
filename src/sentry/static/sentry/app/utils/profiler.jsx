import PropTypes from 'prop-types';
import React from 'react';
import * as Sentry from '@sentry/browser';

import {startRender, finishRender} from 'app/utils/apm';
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

      span = this.initializeSpan();

      initializeSpan() {
        const span = Sentry.startSpan({
          data: {},
          op: 'react',
          description: `<${displayName}>`,
        });
        startRender(displayName);

        // TODO(apm): We could try to associate this component with API client
        // e.g:
        // if (this.props.api) {
        // this.props.api.setParentSpan(span);
        // }

        return span;
      }

      finishProfile = () => {
        if (!this.span) {
          return;
        }

        this.span.finish();
        finishRender(displayName);
        this.span = null;
      };

      render() {
        return <WrappedComponent {...this.props} finishProfile={this.finishProfile} />;
      }
    };
  };
}
