import {Flex, Stack} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';

import {GroupList, type GroupListColumn} from 'sentry/components/issues/groupList';
import * as Layout from 'sentry/components/layouts/thirds';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {
  formatConventionTitle,
  getCodeConventionsPath,
  getConventionIssuesQuery,
} from 'sentry/views/codeConventions/utils';

// Every issue in a convention shares the same kind of title, severity and a
// near-constant event rate (one per scan), so the message, Last Seen, trend,
// events, users and priority columns carry no signal here.
const COLUMNS: GroupListColumn[] = ['firstSeen', 'assignee'];

export default function ConventionIssues() {
  const {conventionName} = useParams<{conventionName: string}>();
  const organization = useOrganization();
  const title = formatConventionTitle(conventionName);
  const issuesQuery = getConventionIssuesQuery(conventionName);

  return (
    <SentryDocumentTitle
      title={`${title} — ${t('Code Quality')}`}
      orgSlug={organization.slug}
    >
      <Stack flex={1}>
        <Layout.Title>{title}</Layout.Title>
        <Layout.Body>
          <Layout.Main width="full">
            <Stack gap="xl">
              <Flex gap="xs">
                <Link to={normalizeUrl(getCodeConventionsPath(organization.slug))}>
                  {t('Code Quality')}
                </Link>
                <Text variant="muted">/</Text>
                <Text>{title}</Text>
              </Flex>
              <GroupList
                queryParams={{...issuesQuery, limit: 25, sort: 'date'}}
                query={issuesQuery.query}
                withColumns={COLUMNS}
                withChart={false}
                hideMessage
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
