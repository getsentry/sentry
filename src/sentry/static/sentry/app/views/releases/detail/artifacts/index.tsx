import React from 'react';
import {RouteComponentProps} from 'react-router';

import AlertLink from 'app/components/alertLink';
import {Body, Main} from 'app/components/layouts/thirds';
import {t, tct} from 'app/locale';
import {Organization} from 'app/types';
import {formatVersion} from 'app/utils/formatters';
import routeTitleGen from 'app/utils/routeTitle';
import withOrganization from 'app/utils/withOrganization';
import AsyncView from 'app/views/asyncView';

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
    const {params, organization} = this.props;

    return (
      <Body>
        <Main fullWidth>
          <AlertLink
            to={`/settings/${organization.slug}/projects/${
              project.slug
            }/source-maps/${encodeURIComponent(params.release)}/`}
            priority="info"
          >
            {tct('Artifacts were moved to [sourceMaps] in Settings.', {
              sourceMaps: <u>{t('Source Maps')}</u>,
            })}
          </AlertLink>
        </Main>
      </Body>
    );
  }
}

export default withOrganization(ReleaseArtifacts);
