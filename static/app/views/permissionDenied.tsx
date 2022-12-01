import {useEffect} from 'react';
import * as Sentry from '@sentry/react';

import ExternalLink from 'sentry/components/links/externalLink';
import LoadingError from 'sentry/components/loadingError';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t, tct} from 'sentry/locale';
import {PageContent} from 'sentry/styles/organization';
import {Organization, Project} from 'sentry/types';
import getRouteStringFromRoutes from 'sentry/utils/getRouteStringFromRoutes';
import {useRoutes} from 'sentry/utils/useRoutes';
import withOrganization from 'sentry/utils/withOrganization';
import withProject from 'sentry/utils/withProject';

const ERROR_NAME = 'Permission Denied';

type Props = {
  organization: Organization;
  project?: Project;
};

function PermissionDenied(props: Props) {
  const {organization, project} = props;
  const routes = useRoutes();
  useEffect(() => {
    const route = getRouteStringFromRoutes(routes);
    Sentry.withScope(scope => {
      scope.setFingerprint([ERROR_NAME, route]);
      scope.setExtra('route', route);
      scope.setExtra('orgFeatures', (organization && organization.features) || []);
      scope.setExtra('orgAccess', (organization && organization.access) || []);
      scope.setExtra('projectFeatures', (project && project.features) || []);
      Sentry.captureException(new Error(`${ERROR_NAME}${route ? ` : ${route}` : ''}`));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <SentryDocumentTitle title={t('Permission Denied')}>
      <PageContent>
        <LoadingError
          message={tct(
            `Your role does not have the necessary permissions to access this
             resource, please read more about [link:organizational roles]`,
            {
              link: (
                <ExternalLink href="https://docs.sentry.io/product/accounts/membership/" />
              ),
            }
          )}
        />
      </PageContent>
    </SentryDocumentTitle>
  );
}

export default withOrganization(withProject(PermissionDenied));
