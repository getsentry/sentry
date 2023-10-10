import {useEffect} from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';

import {Alert} from 'sentry/components/alert';
import ExternalLink from 'sentry/components/links/externalLink';
import List from 'sentry/components/list';
import ListItem from 'sentry/components/list/listItem';
import {t, tct} from 'sentry/locale';
import OrganizationStore from 'sentry/stores/organizationStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import {space} from 'sentry/styles/space';
import {Project} from 'sentry/types';
import getRouteStringFromRoutes from 'sentry/utils/getRouteStringFromRoutes';
import {useRoutes} from 'sentry/utils/useRoutes';
import withProject from 'sentry/utils/withProject';

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
    const enrichScopeContext = (scope: Sentry.Scope) => {
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
        Sentry.showReportDialog();
      }
    });

    return function cleanup() {
      window.clearTimeout(reportDialogTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error, disableLogSentry]);

  // Remove the report dialog on unmount
  useEffect(() => () => document.querySelector('.sentry-error-embed-wrapper')?.remove());

  // TODO(dcramer): show additional resource links
  return (
    <Alert type="error">
      <Heading>{t('Oops! Something went wrong')}</Heading>
      <p>
        {t(`
          It looks like you've hit an issue in our client application. Don't worry though!
          We use Sentry to monitor Sentry and it's likely we're already looking into this!
          `)}
      </p>
      <p>{t("If you're daring, you may want to try the following:")}</p>
      <List symbol="bullet">
        {window && window.adblockSuspected && (
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
                  window.location.href = window.location.href;
                }}
              />
            ),
          })}
        </ListItem>
        <ListItem>
          {tct(`If all else fails, [link:contact us] with more details.`, {
            link: (
              <ExternalLink href="https://github.com/getsentry/sentry/issues/new/choose" />
            ),
          })}
        </ListItem>
      </List>
    </Alert>
  );
}

const Heading = styled('h1')`
  font-size: ${p => p.theme.fontSizeLarge};
  line-height: 1.4;
  margin-bottom: ${space(1)};
`;

export default withProject(RouteError);
