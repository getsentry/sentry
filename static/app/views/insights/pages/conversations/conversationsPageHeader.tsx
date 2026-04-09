import {Fragment} from 'react';

import {FeatureBadge} from '@sentry/scraps/badge';

import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useOrganization} from 'sentry/utils/useOrganization';
import {
  CONVERSATIONS_LANDING_SUB_PATH,
  CONVERSATIONS_LANDING_TITLE,
  CONVERSATIONS_SIDEBAR_LABEL,
} from 'sentry/views/insights/pages/conversations/settings';
import {
  DomainViewHeader,
  type Props as HeaderProps,
} from 'sentry/views/insights/pages/domainViewHeader';

type Props = {
  breadcrumbs?: HeaderProps['additionalBreadCrumbs'];
  headerActions?: HeaderProps['additonalHeaderActions'];
  hideDefaultTabs?: HeaderProps['hideDefaultTabs'];
};

export function ConversationsPageHeader({
  headerActions,
  breadcrumbs,
  hideDefaultTabs,
}: Props) {
  const organization = useOrganization();

  const conversationsBaseUrl = normalizeUrl(
    `/organizations/${organization.slug}/explore/${CONVERSATIONS_LANDING_SUB_PATH}/`
  );

  return (
    <DomainViewHeader
      domainBaseUrl={conversationsBaseUrl}
      domainTitle={CONVERSATIONS_SIDEBAR_LABEL}
      headerTitle={
        <Fragment>
          {CONVERSATIONS_LANDING_TITLE}
          <FeatureBadge type="alpha" />
        </Fragment>
      }
      modules={[]}
      selectedModule={undefined}
      additonalHeaderActions={headerActions}
      additionalBreadCrumbs={breadcrumbs}
      hideDefaultTabs={hideDefaultTabs}
      hasOverviewPage={false}
      unified
    />
  );
}
