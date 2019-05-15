import React from 'react';
import DocumentTitle from 'react-document-title';

import {t} from 'app/locale';
import SentryTypes from 'app/sentryTypes';
import GlobalSelectionHeader from 'app/components/organizations/globalSelectionHeader';
import {PageContent, PageHeader} from 'app/styles/organization';
import PageHeading from 'app/components/pageHeading';
import BetaTag from 'app/components/betaTag';

export default class OrganizationEventsV2 extends React.Component {
  static propTypes = {
    organization: SentryTypes.Organization,
  };

  render() {
    const {organization} = this.props;

    return (
      <DocumentTitle title={`Events - ${organization.slug} - Sentry`}>
        <React.Fragment>
          <GlobalSelectionHeader organization={organization} />
          <PageContent>
            <PageHeader>
              <PageHeading>
                {t('Events')} <BetaTag />
              </PageHeading>
            </PageHeader>
          </PageContent>
        </React.Fragment>
      </DocumentTitle>
    );
  }
}
