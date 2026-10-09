import {parseAsStringLiteral, useQueryState} from 'nuqs';

import {FeatureBadge} from '@sentry/scraps/badge';
import {BreadcrumbList} from '@sentry/scraps/breadcrumbList';
import {Flex, Stack} from '@sentry/scraps/layout';

import {
  GroupList,
  type GroupListColumn,
  type GroupListSection,
  type GroupListTitleSort,
} from 'sentry/components/issues/groupList';
import * as Layout from 'sentry/components/layouts/thirds';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {IconGithub} from 'sentry/icons';
import {t} from 'sentry/locale';
import {ProgressState, type Group} from 'sentry/types/group';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {ConventionOverview} from 'sentry/views/codeConventions/conventionOverview';
import {
  formatConventionTitle,
  getCodeConventionsPath,
  getConventionIssuesQuery,
} from 'sentry/views/codeConventions/utils';
import {
  formatProgressState,
  getProgressIcon,
} from 'sentry/views/issueList/utils/progress';
import {TopBar} from 'sentry/views/navigation/topBar';

// Every issue in a convention shares the same kind of title, severity and a
// near-constant event rate (one per scan), so the message, Last Seen, trend,
// events, users and priority columns carry no signal here.
const COLUMNS: GroupListColumn[] = ['firstSeen', 'autofix', 'assignee'];

// Sorting by title happens in the browser, so load enough issues that one page
// holds a whole convention.
const PAGE_SIZE = 100;

// The inbox's sections and order. Untouched issues, which the inbox folds into
// Assigned, get their own section here since most convention issues have no
// assignee.
const PROGRESS_SECTIONS = [
  ProgressState.FIX_PROPOSED,
  ProgressState.DIAGNOSED,
  ProgressState.ASSIGNED,
  ProgressState.FIX_APPLIED,
  ProgressState.IDENTIFIED,
];

function groupByProgress(groups: Group[]): GroupListSection[] {
  return PROGRESS_SECTIONS.map(progress => ({
    key: progress,
    label: (
      <Flex align="center" gap="sm">
        {getProgressIcon(progress)}
        {formatProgressState(progress)}
      </Flex>
    ),
    groups: groups.filter(
      group => (group.derivedData?.progress ?? ProgressState.IDENTIFIED) === progress
    ),
  }));
}

export default function ConventionIssues() {
  const {repoName, conventionName} = useParams<{
    conventionName: string;
    repoName: string;
  }>();
  const organization = useOrganization();
  const title = formatConventionTitle(conventionName);
  const issuesQuery = getConventionIssuesQuery(conventionName);
  const [sort, setSort] = useQueryState(
    'sort',
    parseAsStringLiteral(['title', '-title'] as const)
  );
  const titleSort: GroupListTitleSort = {
    direction: sort === 'title' ? 'asc' : sort === '-title' ? 'desc' : null,
    onChange: direction => setSort(direction === 'asc' ? 'title' : '-title'),
  };

  return (
    <SentryDocumentTitle
      title={`${title} — ${t('Code Quality')}`}
      orgSlug={organization.slug}
    >
      <Stack flex={1}>
        <TopBar.Slot name="breadcrumbs">
          <BreadcrumbList
            items={[
              {
                type: 'link',
                label: t('Code Quality'),
                to: normalizeUrl(getCodeConventionsPath(organization.slug)),
              },
              {
                type: 'link',
                label: repoName,
                leadingGraphic: <IconGithub />,
                to: {
                  pathname: normalizeUrl(getCodeConventionsPath(organization.slug)),
                  query: {repo: repoName},
                },
              },
            ]}
          />
        </TopBar.Slot>
        <Layout.Title>
          <Flex align="center" gap="sm">
            {title}
            <FeatureBadge type="alpha" />
          </Flex>
        </Layout.Title>
        <Layout.Body>
          <Layout.Main width="full">
            <Stack gap="lg">
              <ConventionOverview conventionName={conventionName} />
              <GroupList
                queryParams={{
                  ...issuesQuery,
                  limit: PAGE_SIZE,
                  sort: 'date',
                  // Carries each issue's Autofix step without a request per row.
                  expand: ['derivedData'],
                }}
                query={issuesQuery.query}
                withColumns={COLUMNS}
                withChart={false}
                hideMessage
                titleSort={titleSort}
                groupSections={groupByProgress}
                canSelectGroups={false}
                numPlaceholderRows={10}
                source="code-conventions"
              />
            </Stack>
          </Layout.Main>
        </Layout.Body>
      </Stack>
    </SentryDocumentTitle>
  );
}
