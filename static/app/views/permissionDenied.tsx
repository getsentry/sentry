import {Component} from 'react';
import DocumentTitle from 'react-document-title';
import {withRouter, WithRouterProps} from 'react-router';
import * as Sentry from '@sentry/react';

import ExternalLink from 'app/components/links/externalLink';
import LoadingError from 'app/components/loadingError';
import {t, tct} from 'app/locale';
import {PageContent} from 'app/styles/organization';
import {LightWeightOrganization, Project} from 'app/types';
import getRouteStringFromRoutes from 'app/utils/getRouteStringFromRoutes';
import withOrganization from 'app/utils/withOrganization';
import withProject from 'app/utils/withProject';

const ERROR_NAME = 'Permission Denied';

type Props = WithRouterProps & {
  organization: LightWeightOrganization;
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
      <DocumentTitle title={t('Permission Denied')}>
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
      </DocumentTitle>
    );
  }
}

export default withRouter(withOrganization(withProject(PermissionDenied)));
