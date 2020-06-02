import {RouteComponentProps} from 'react-router/lib/Router';
import React from 'react';

import {t} from 'app/locale';
import AsyncView from 'app/views/asyncView';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import {Organization, Project} from 'app/types';
import routeTitleGen from 'app/utils/routeTitle';

type Props = RouteComponentProps<{orgId: string; projectId: string}, {}> & {
  organization: Organization;
  project: Project;
};

type State = AsyncView['state'] & {
  //
};

class ProjectSourceMaps extends AsyncView<Props, State> {
  getTitle() {
    const {projectId} = this.props.params;

    return routeTitleGen(t('Source Maps'), projectId, false);
  }

  getDefaultState(): State {
    return {
      ...super.getDefaultState(),
      //
    };
  }

  getEndpoints() {
    const endpoints: ReturnType<AsyncView['getEndpoints']> = [];

    return endpoints;
  }

  renderLoading() {
    return this.renderBody();
  }

  renderBody() {
    return (
      <React.Fragment>
        <SettingsPageHeader title={t('Source Maps')} />
      </React.Fragment>
    );
  }
}

export default ProjectSourceMaps;
