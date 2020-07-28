import {withRouter} from 'react-router';
import PropTypes from 'prop-types';
import React from 'react';
import * as Sentry from '@sentry/react';
import styled from '@emotion/styled';

import getRouteStringFromRoutes from 'app/utils/getRouteStringFromRoutes';
import {IconWarning} from 'app/icons';
import space from 'app/styles/space';

class RouteError extends React.Component {
  static propTypes = {
    /**
     * Disable logging to Sentry
     */
    disableLogSentry: PropTypes.bool,
    disableReport: PropTypes.bool,
    error: PropTypes.object.isRequired,
    routes: PropTypes.array,
  };

  static contextTypes = {
    organization: PropTypes.object,
    project: PropTypes.object,
  };

  UNSAFE_componentWillMount() {
    const {error} = this.props;
    const {disableLogSentry, disableReport, routes} = this.props;
    const {organization, project} = this.context;

    if (disableLogSentry) {
      return;
    }
    if (!error) {
      return;
    }

    const route = getRouteStringFromRoutes(routes);
    const enrichScopeContext = scope => {
      scope.setExtra('route', route);
      scope.setExtra('orgFeatures', (organization && organization.features) || []);
      scope.setExtra('orgAccess', (organization && organization.access) || []);
      scope.setExtra('projectFeatures', (project && project.features) || []);
      return scope;
    };

    if (route) {
      /**
       * Unexpectedly, error.message would sometimes not have a setter property, causing another exception to be thrown,
       * and losing the original error in the process. Wrapping the mutation in a try-catch in an attempt to preserve
       * the original error for logging.
       * See https://github.com/getsentry/sentry/issues/16314 for more details.
       */
      try {
        error.message = `${error.message}: ${route}`;
      } catch (e) {
        Sentry.withScope(scope => {
          enrichScopeContext(scope);
          Sentry.captureException(e);
        });
      }
    }
    // TODO(dcramer): show something in addition to embed (that contains it?)
    // throw this in a timeout so if it errors we dont fall over
    this._timeout = window.setTimeout(() => {
      Sentry.withScope(scope => {
        enrichScopeContext(scope);
        Sentry.captureException(error);
      });

      if (!disableReport) {
        Sentry.showReportDialog();
      }
    });
  }

  componentWillUnmount() {
    if (this._timeout) {
      window.clearTimeout(this._timeout);
    }
    document.querySelector('.sentry-error-embed-wrapper')?.remove();
  }

  render() {
    // TODO(dcramer): show additional resource links
    return (
      <div className="alert alert-block alert-error">
        <Heading>
          <StyledIconWarning size="md" />
          <span>Oops! Something went wrong</span>
        </Heading>
        <p>
          It looks like you've hit an issue in our client application. Don't worry though!
          We use Sentry to monitor Sentry and it's likely we're already looking into this!
        </p>
        <p>If you're daring, you may want to try the following:</p>
        <ul>
          {window && window.adblockSuspected && (
            <li>
              We detected something AdBlock-like. Try disabling it, as it's known to cause
              issues.
            </li>
          )}
          <li>
            Give it a few seconds and{' '}
            <a
              onClick={() => {
                window.location.href = window.location.href;
              }}
            >
              reload the page
            </a>
            .
          </li>
          <li>
            If all else fails,{' '}
            <a href="http://github.com/getsentry/sentry/issues">create an issue</a> with
            more details.
          </li>
        </ul>
      </div>
    );
  }
}

const Heading = styled('h3')`
  display: flex;
  align-items: center;

  font-size: ${p => p.theme.headerFontSize};
  font-weight: normal;

  margin-bottom: ${space(1.5)};
`;

const StyledIconWarning = styled(IconWarning)`
  margin-right: ${space(1)};
`;

export default withRouter(RouteError);
export {RouteError};
