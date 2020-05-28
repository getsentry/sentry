import React from 'react';

import {t} from 'app/locale';
import AsyncView from 'app/views/asyncView';
import EmptyStateWarning from 'app/components/emptyStateWarning';
import ReleaseLanding from 'app/views/releases/list/releaseLanding';

type Props = {
  orgSlug: string;
} & AsyncView['props'];

class ReleasePromo extends AsyncView<Props> {
  // if there are no releases in the last 30 days, we want to show releases promo
  getEndpoints(): ReturnType<AsyncView['getEndpoints']> {
    const {orgSlug} = this.props;

    const query = {
      per_page: 1,
      summaryStatsPeriod: '30d',
    };

    return [['releases', `/organizations/${orgSlug}/releases/`, {query}]];
  }

  renderBody() {
    if (this.state.releases.length === 0) {
      return <ReleaseLanding />;
    }

    return <EmptyStateWarning small>{t('There are no releases.')}</EmptyStateWarning>;
  }
}

export default ReleasePromo;
