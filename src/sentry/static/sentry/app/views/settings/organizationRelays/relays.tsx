import React from 'react';
import {RouteComponentProps} from 'react-router/lib/Router';

import {t} from 'app/locale';
import AsyncComponent from 'app/components/asyncComponent';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import {Organization} from 'app/types';

type Props = {
  organization: Organization;
} & RouteComponentProps<{orgId: string}, {}>;

class Relays extends AsyncComponent<Props> {
  renderBody() {
    return (
      <React.Fragment>
        <SettingsPageHeader title={t('Relays')} />
      </React.Fragment>
    );
  }
}

export default Relays;
