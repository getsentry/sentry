import {Fragment, useEffect, useState} from 'react';

import NoProjectMessage from 'sentry/components/noProjectMessage';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import GroupStore from 'sentry/stores/groupStore';
import {Organization, Project} from 'sentry/types';
import withOrganization from 'sentry/utils/withOrganization';
import SampleEventAlert from 'sentry/views/organizationGroupDetails/sampleEventAlert';

type Props = {
  children: React.ReactChildren;
  organization: Organization;
  projects: Project[];
};

function IssueListContainer({organization, children}: Props) {
  const [showSampleEventBanner, setShowSampleEventBanner] = useState(false);

  useEffect(() => {
    const unlistener = GroupStore.listen(
      () => setShowSampleEventBanner(GroupStore.getAllItemIds().length === 1),
      undefined
    );

    return () => unlistener();
  }, []);

  return (
    <SentryDocumentTitle title={t('Issues')} orgSlug={organization.slug}>
      <Fragment>
        {showSampleEventBanner && <SampleEventAlert />}
        <PageFiltersContainer
          hideGlobalHeader={organization.features.includes('selection-filters-v2')}
        >
          <NoProjectMessage organization={organization}>{children}</NoProjectMessage>
        </PageFiltersContainer>
      </Fragment>
    </SentryDocumentTitle>
  );
}

export default withOrganization(IssueListContainer);
