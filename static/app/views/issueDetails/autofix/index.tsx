import {Fragment} from 'react';

import {BreadcrumbList} from '@sentry/scraps/breadcrumbList';
import {Stack} from '@sentry/scraps/layout';

import {AnalyticsArea} from 'sentry/components/analyticsArea';
import {NotFound} from 'sentry/components/errors/notFound';
import {PageFiltersContainer} from 'sentry/components/pageFilters/container';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {useProjects} from 'sentry/utils/useProjects';
import {hasAutofixPage} from 'sentry/views/issueDetails/autofix/utils';
import {IssueDetailsContextProvider} from 'sentry/views/issueDetails/context';
import {EventDetailsHeader} from 'sentry/views/issueDetails/eventDetailsHeader';
import {GroupIdProvider} from 'sentry/views/issueDetails/groupIdContext';
import {useGroup} from 'sentry/views/issueDetails/useGroup';
import {IssuePreview} from 'sentry/views/issueList/pages/inbox/issuePreview/issuePreview';
import {TopBar} from 'sentry/views/navigation/topBar';

const TITLE = t('Autofix');

export default function AutofixPage() {
  const organization = useOrganization();
  const {groupId} = useParams<{groupId: string}>();

  if (!hasAutofixPage(organization)) {
    return <NotFound />;
  }

  return (
    <SentryDocumentTitle title={TITLE} orgSlug={organization.slug}>
      <AnalyticsArea name="autofix_page">
        <AutofixBreadcrumbs groupId={groupId} />
        {/*
         * `contain="size"` keeps this column's height out of the flex
         * calculation, so it fills Layout.Page rather than growing with the
         * preview. Without it the whole page scrolls and IssuePreview's own
         * scroll container never gets a bounded height.
         */}
        <Stack flex={1} minWidth={0} minHeight={0} contain="size" overflow="hidden">
          <GroupIdProvider groupId={groupId}>
            <AutofixPageContent groupId={groupId} />
          </GroupIdProvider>
        </Stack>
      </AnalyticsArea>
    </SentryDocumentTitle>
  );
}

/**
 * The issue details route stands up the page filters, the issue details
 * context and the group id for everything beneath it. This page is a sibling
 * route, so it has to supply them itself or EventDetailsHeader renders an
 * inert filter bar and its EventGraph throws.
 *
 * EventDetailsHeader also needs a resolved group and project, which
 * IssuePreview otherwise fetches for itself. The group query is shared, so
 * asking for it here costs no extra request.
 */
function AutofixPageContent({groupId}: {groupId: string}) {
  const {data: group} = useGroup({groupId});
  const {projects} = useProjects();
  const project = projects.find(p => p.id === group?.project.id) ?? group?.project;

  return (
    <PageFiltersContainer
      skipLoadLastUsed
      forceProject={group?.project}
      shouldForceProject
    >
      <IssueDetailsContextProvider>
        {group && project && <EventDetailsHeader group={group} project={project} />}
        <IssuePreview groupId={groupId} />
      </IssueDetailsContextProvider>
    </PageFiltersContainer>
  );
}

/**
 * Renders "Issues / ABC-123 / Autofix". The short-id crumb waits on the group
 * request; the surrounding crumbs render immediately so the trail does not
 * shift once it resolves.
 */
function AutofixBreadcrumbs({groupId}: {groupId: string}) {
  const organization = useOrganization();
  const location = useLocation();
  const {data: group} = useGroup({groupId});

  const issuesPath = `/organizations/${organization.slug}/issues/`;

  return (
    <Fragment>
      <TopBar.Slot name="breadcrumbs">
        <BreadcrumbList
          items={[
            {
              type: 'link',
              label: t('Issues'),
              to: {pathname: issuesPath, query: location.query},
            },
            ...(group
              ? [
                  {
                    type: 'link' as const,
                    label: group.shortId,
                    to: {pathname: `${issuesPath}${groupId}/`, query: location.query},
                  },
                ]
              : []),
          ]}
        />
      </TopBar.Slot>
      <TopBar.Slot name="title">
        <BreadcrumbList.Title item={{type: 'page-title', label: TITLE}} />
      </TopBar.Slot>
    </Fragment>
  );
}
