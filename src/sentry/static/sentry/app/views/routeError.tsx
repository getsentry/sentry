import {withRouter, WithRouterProps} from 'react-router';
import PropTypes from 'prop-types';
import React from 'react';
import * as Sentry from '@sentry/react';
import styled from '@emotion/styled';

import Alert from 'app/components/alert';
import {t, tct} from 'app/locale';
import getRouteStringFromRoutes from 'app/utils/getRouteStringFromRoutes';
import {IconWarning} from 'app/icons';
import space from 'app/styles/space';

type Props = WithRouterProps & {
  error: Error | undefined;
  /**
   * Disable logging to Sentry
   */
  disableLogSentry?: boolean;
  disableReport?: boolean;
};

class RouteError extends React.Component<Props> {
  static propTypes = {
    disableLogSentry: PropTypes.bool,
    disableReport: PropTypes.bool,
    error: PropTypes.instanceOf(Error),
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

  private _timeout: undefined | number;

  render() {
    // TODO(dcramer): show additional resource links
    return (
      <Alert icon={<IconWarning size="md" />} type="error">
        <Heading>
          <span>{t('Oops! Something went wrong')}</span>
        </Heading>
        <p>
          {t(`
          It looks like you've hit an issue in our client application. Don't worry though!
          We use Sentry to monitor Sentry and it's likely we're already looking into this!
          `)}
        </p>
        <p>{t("If you're daring, you may want to try the following:")}</p>
        <ul>
          {window && window.adblockSuspected && (
            <li>
              {t(
                "We detected something AdBlock-like. Try disabling it, as it's known to cause issues."
              )}
            </li>
          )}
          <li>
            {tct(`Give it a few seconds and [link:reload the page].`, {
              link: (
                <a
                  onClick={() => {
                    window.location.href = window.location.href;
                  }}
                />
              ),
            })}
          </li>
          <li>
            {tct(`If all else fails, [link:create an issue] with more details.`, {
              link: <a href="http://github.com/getsentry/sentry/issues" />,
            })}
          </li>
        </ul>
      </Alert>
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

export default withRouter(RouteError);
export {RouteError};
