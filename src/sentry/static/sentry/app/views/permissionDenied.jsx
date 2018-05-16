import {withRouter} from 'react-router';
import DocumentTitle from 'react-document-title';
import PropTypes from 'prop-types';
import Raven from 'raven-js';
import React from 'react';

import {t, tct} from 'app/locale';
import ExternalLink from 'app/components/externalLink';
import LoadingError from 'app/components/loadingError';
import getRouteStringFromRoutes from 'app/utils/getRouteStringFromRoutes';

const ERROR_NAME = 'Permission Denied';

class PermissionDenied extends React.Component {
  static propTypes = {
    routes: PropTypes.array,
  };

  static contextTypes = {
    organization: PropTypes.object,
    project: PropTypes.object,
  };

  componentDidMount() {
    let {routes} = this.props;
    let {organization, project} = this.context;

    let route = getRouteStringFromRoutes(routes);
    Raven.captureException(new Error(ERROR_NAME), {
      fingerprint: [ERROR_NAME, route],
      extra: {
        route,
        orgFeatures: (organization && organization.features) || [],
        orgAccess: (organization && organization.access) || [],
        projectFeatures: (project && project.features) || [],
      },
    });
  }

  render() {
    return (
      <DocumentTitle title={t('Permission Denied')}>
        <LoadingError
          message={tct(
            'Your role does not have the necessary permissions to access this resource, please read more about [link:organizational roles]',
            {
              link: <ExternalLink href="https://docs.sentry.io/learn/membership/" />,
            }
          )}
        />
      </DocumentTitle>
    );
  }
}

export default withRouter(PermissionDenied);
