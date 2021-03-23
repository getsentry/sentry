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

class Explorer extends AsyncView<Props, State> {
  getTitle() {
    const {organization} = this.props;
    return routeTitle(t('Metrics - Explorer'), organization.slug, false);
  }

  renderLoading() {
    return this.renderBody();
  }

  renderBody() {
    return <div>Explorer</div>;
  }
}

export default withOrganization(Explorer);
