import React from 'react';
import {RouteComponentProps} from 'react-router/lib/Router';

import {t, tct} from 'app/locale';
import ReleaseArtifactsV1 from 'app/views/releases/detail/releaseArtifacts';
import AsyncView from 'app/views/asyncView';
import routeTitleGen from 'app/utils/routeTitle';
import {formatVersion} from 'app/utils/formatters';
import withOrganization from 'app/utils/withOrganization';
import {Organization} from 'app/types';
import AlertLink from 'app/components/alertLink';
import Feature from 'app/components/acl/feature';

import {ReleaseContext} from '..';

type RouteParams = {
  orgId: string;
  release: string;
};

type Props = RouteComponentProps<RouteParams, {}> & {
  organization: Organization;
};

class ReleaseArtifacts extends AsyncView<Props> {
  static contextType = ReleaseContext;

  getTitle() {
    const {params, organization} = this.props;
    return routeTitleGen(
      t('Artifacts - Release %s', formatVersion(params.release)),
      organization.slug,
      false
    );
  }

  renderBody() {
    const {project} = this.context;
    const {params, location, organization} = this.props;

    return (
      <React.Fragment>
        <Feature features={['artifacts-in-settings']}>
          <AlertLink
            to={`/settings/${organization.slug}/projects/${project.slug}/source-maps/`}
            priority="info"
          >
            {tct('Artifacts were moved to [sourceMaps] in Settings.', {
              sourceMaps: <u>{t('Source Maps')}</u>,
            })}
          </AlertLink>
        </Feature>

        <ReleaseArtifactsV1
          params={params}
          location={location}
          projectId={project.slug}
          smallEmptyMessage
        />
      </React.Fragment>
    );
  }
}

export default withOrganization(ReleaseArtifacts);
