import {useEffect} from 'react';
import styled from '@emotion/styled';
import type {Scope} from '@sentry/core';
import * as Sentry from '@sentry/react';

import {Alert} from '@sentry/scraps/alert';
import {ExternalLink} from '@sentry/scraps/link';

import {getLastEventId} from 'sentry/bootstrap/initializeSdk';
import {List} from 'sentry/components/list';
import ListItem from 'sentry/components/list/listItem';
import {t, tct} from 'sentry/locale';
import {OrganizationStore} from 'sentry/stores/organizationStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import type {Project} from 'sentry/types/project';
import {getRouteStringFromRoutes} from 'sentry/utils/getRouteStringFromRoutes';
import {useRoutes} from 'sentry/utils/useRoutes';
import {withProject} from 'sentry/utils/withProject';

type Props = {
  /**
   * Disable logging to Sentry
   */
  disableLogSentry?: boolean;
  /**
   * Disable the report dialog
   */
  disableReport?: boolean;
  error?: Error;
  project?: Project;
};

function RouteError({error, disableLogSentry, disableReport, project}: Props) {
  const routes = useRoutes();
  const {organization} = useLegacyStore(OrganizationStore);

  useEffect(() => {
    if (disableLogSentry) {
      return undefined;
    }
    if (!error) {
      return undefined;
    }

    const route = getRouteStringFromRoutes(routes);
    const enrichScopeContext = (scope: Scope) => {
      scope.setExtra('route', route);
      scope.setExtra('orgFeatures', organization?.features ?? []);
      scope.setExtra('orgAccess', organization?.access ?? []);
      scope.setExtra('projectFeatures', project?.features ?? []);
      return scope;
    };

    if (route) {
      // Unexpectedly, error.message would sometimes not have a setter
      // property, causing another exception to be thrown, and losing the
      // original error in the process. Wrapping the mutation in a try-catch in
      // an attempt to preserve the original error for logging.
      //
      // See https://github.com/getsentry/sentry/issues/16314 for more details.
      try {
        error.message = `${error.message}: ${route}`;
      } catch (e) {
        Sentry.withScope(scope => {
          enrichScopeContext(scope);
          scope.setExtra('cannotSetMessage', true);
        });
      }
    }

    // TODO(dcramer): show something in addition to embed (that contains it?)
    // throw this in a timeout so if it errors we don't fall over
    const reportDialogTimeout = window.setTimeout(() => {
      Sentry.withScope(scope => {
        enrichScopeContext(scope);
        Sentry.captureException(error);
      });

      if (!disableReport) {
        Sentry.showReportDialog({eventId: getLastEventId() || ''});
      }
    });

    return function cleanup() {
      window.clearTimeout(reportDialogTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error, disableLogSentry]);

  // Remove the report dialog on unmount
  useEffect(() => () => document.querySelector('.sentry-error-embed-wrapper')?.remove());

  return (
    <Alert.Container>
      <Alert variant="danger" showIcon={false}>
        <Heading>{t('Oops! Something went wrong')}</Heading>
        <p>
          {t(`
          It looks like you've hit an issue in our client application. Don't worry though!
          We use Sentry to monitor Sentry and it's likely we're already looking into this!
          `)}
        </p>
        <p style={{marginBottom: 0}}>
          {t("If you're daring, you may want to try the following:")}
        </p>
        <List symbol="bullet">
          {window?.adblockSuspected && (
            <ListItem>
              {t(
                "We detected something AdBlock-like. Try disabling it, as it's known to cause issues."
              )}
            </ListItem>
          )}
          <ListItem>
            {tct(`Give it a few seconds and [link:reload the page].`, {
              link: (
                <a
                  onClick={() => {
                    window.location.href = String(window.location.href);
                  }}
                />
              ),
            })}
          </ListItem>
          <ListItem>
            {tct(
              `Still stuck? Our [link:troubleshooting guide] has tips for common browser-related issues.`,
              {
                link: (
                  <ExternalLink href="https://sentry.zendesk.com/hc/en-us/articles/22088541158555-Why-Sentry-io-is-not-loading" />
                ),
              }
            )}
          </ListItem>
        </List>
        <p style={{marginTop: '1em', marginBottom: 0}}>
          {tct(
            `If the guide does not help, [link:contact support] — include as many of these details as you can:`,
            {
              link: <ExternalLink href="https://sentry.zendesk.com/hc/en-us" />,
            }
          )}
        </p>
        <List symbol="bullet">
          <ListItem>{t('Browser logs (console and network tab errors)')}</ListItem>
          <ListItem>
            {t(
              'Whether anyone else in your organization sees the same error on that page'
            )}
          </ListItem>
          <ListItem>{t('Which browser(s) and version(s) you are using')}</ListItem>
          <ListItem>{t('Whether the error is intermittent or consistent')}</ListItem>
          <ListItem>
            {t('Whether the error only appears on that page, or on other pages too')}
          </ListItem>
        </List>
      </Alert>
    </Alert.Container>
  );
}

const Heading = styled('h1')`
  font-size: ${p => p.theme.font.size.lg};
  line-height: 1.4;
  margin-bottom: ${p => p.theme.space.md};
`;

export default withProject(RouteError);
