import React from 'react';
import * as ReactRouter from 'react-router';
import {Params} from 'react-router/lib/Router';
import {Location} from 'history';

import {t} from 'app/locale';
import {Organization} from 'app/types';
import AsyncView from 'app/views/asyncView';
import GlobalSelectionHeader from 'app/components/organizations/globalSelectionHeader';
import NoProjectMessage from 'app/components/noProjectMessage';
import {PageContent, PageHeader} from 'app/styles/organization';
import PageHeading from 'app/components/pageHeading';
import withOrganization from 'app/utils/withOrganization';
import routeTitleGen from 'app/utils/routeTitle';
import LoadingIndicator from 'app/components/loadingIndicator';
import EmptyStateWarning from 'app/components/emptyStateWarning';

type Props = {
  organization: Organization;
  location: Location;
  router: ReactRouter.InjectedRouter;
  params: Params;
} & AsyncView['props'];

type State = {} & AsyncView['state'];

class HealthDetail extends AsyncView<Props, State> {
  getTitle() {
    return routeTitleGen(t('Health Detail'), this.props.organization.slug, false);
  }

  getDefaultState() {
    return {
      ...super.getDefaultState(),
    };
  }

  getEndpoints(): [string, string][] {
    return [['dummy', '/organizations/sentry/projects/']];
  }

  renderLoading() {
    return this.renderBody();
  }

  renderEmpty() {
    return (
      <EmptyStateWarning small>
        {t('There are no dummy health something.')}
      </EmptyStateWarning>
    );
  }

  renderInnerBody() {
    const {loading, dummy} = this.state;

    if (loading) {
      return <LoadingIndicator />;
    }

    if (!dummy.length) {
      return this.renderEmpty();
    }

    return (
      <p>
        Results: Lorem, ipsum dolor sit amet consectetur adipisicing elit. Illo dicta
        pariatur incidunt sit vitae laborum, suscipit ducimus atque dolor nostrum rem
        minima reiciendis nihil omnis eius, consequuntur eos nobis molestias!
      </p>
    );
  }

  renderBody() {
    const {organization} = this.props;

    return (
      <React.Fragment>
        <GlobalSelectionHeader organization={organization} />

        <NoProjectMessage organization={organization}>
          <PageContent>
            <PageHeader>
              <PageHeading withMargins>
                {t('Health Detail')} {this.props.params.healthSlug}
              </PageHeading>
            </PageHeader>

            {this.renderInnerBody()}
          </PageContent>
        </NoProjectMessage>
      </React.Fragment>
    );
  }
}

export default withOrganization(HealthDetail);
export {HealthDetail};
