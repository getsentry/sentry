import {Fragment} from 'react';

import {FeatureBadge} from '@sentry/scraps/badge';

import {
  CONVERSATIONS_LANDING_TITLE,
  CONVERSATIONS_SIDEBAR_LABEL,
} from 'sentry/views/explore/conversations/settings';
import {
  DomainViewHeader,
  type Props as HeaderProps,
} from 'sentry/views/insights/pages/domainViewHeader';

type Props = {
  domainBaseUrl: string;
  breadcrumbs?: HeaderProps['additionalBreadCrumbs'];
  headerActions?: HeaderProps['additonalHeaderActions'];
  headerTitle?: HeaderProps['headerTitle'];
  hideDefaultTabs?: HeaderProps['hideDefaultTabs'];
};

export function ConversationsPageHeader({
  headerActions,
  headerTitle,
  breadcrumbs,
  hideDefaultTabs,
  domainBaseUrl,
}: Props) {
  return (
    <DomainViewHeader
      domainBaseUrl={domainBaseUrl}
      domainTitle={CONVERSATIONS_SIDEBAR_LABEL}
      headerTitle={
        headerTitle ?? (
          <Fragment>
            {CONVERSATIONS_LANDING_TITLE}
            <FeatureBadge type="alpha" />
          </Fragment>
        )
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
