import React from 'react';

import {t} from 'app/locale';
import {Organization} from 'app/types';
import routeTitle from 'app/utils/routeTitle';
import withOrganization from 'app/utils/withOrganization';
import AsyncView from 'app/views/asyncView';

type Props = AsyncView['props'] & {
  organization: Organization;
};

type State = AsyncView['state'] & {};

class Dashboards extends AsyncView<Props, State> {
  getTitle() {
    const {organization} = this.props;
    return routeTitle(t('Metrics - Dashboards'), organization.slug, false);
  }

  renderLoading() {
    return this.renderBody();
  }

  renderBody() {
    return <div>Dashboards</div>;
  }
}

export default withOrganization(Dashboards);
