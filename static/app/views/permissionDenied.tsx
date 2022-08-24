import {Component} from 'react';
// eslint-disable-next-line no-restricted-imports
import {withRouter, WithRouterProps} from 'react-router';
import * as Sentry from '@sentry/react';

import ExternalLink from 'sentry/components/links/externalLink';
import LoadingError from 'sentry/components/loadingError';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t, tct} from 'sentry/locale';
import {PageContent} from 'sentry/styles/organization';
import type {Organization, Project} from 'sentry/types';
import getRouteStringFromRoutes from 'sentry/utils/getRouteStringFromRoutes';
import withOrganization from 'sentry/utils/withOrganization';
import withProject from 'sentry/utils/withProject';

const ERROR_NAME = 'Permission Denied';

type Props = WithRouterProps & {
  organization: Organization;
  project?: Project;
};

class PermissionDenied extends Component<Props> {
  componentDidMount() {
    const {organization, project, routes} = this.props;

    const route = getRouteStringFromRoutes(routes);
    Sentry.withScope(scope => {
      scope.setFingerprint([ERROR_NAME, route]);
      scope.setExtra('route', route);
      scope.setExtra('orgFeatures', (organization && organization.features) || []);
      scope.setExtra('orgAccess', (organization && organization.access) || []);
      scope.setExtra('projectFeatures', (project && project.features) || []);
      Sentry.captureException(new Error(`${ERROR_NAME}${route ? ` : ${route}` : ''}`));
    });
  }

  render() {
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
}

export default withRouter(withOrganization(withProject(PermissionDenied)));
