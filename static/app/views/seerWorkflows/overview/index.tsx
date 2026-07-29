import {Fragment} from 'react';

import {Alert} from '@sentry/scraps/alert';
import {InfoTip} from '@sentry/scraps/info';
import {Stack} from '@sentry/scraps/layout';

import Feature from 'sentry/components/acl/feature';
import * as Layout from 'sentry/components/layouts/thirds';
import {PageFiltersContainer} from 'sentry/components/pageFilters/container';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {TimezoneProvider} from 'sentry/components/timezoneProvider';
import {t} from 'sentry/locale';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';

import {FocusedIssue} from './focusedIssue';
import {OverviewFilters} from './overviewFilters';
import {DEFAULT_STATS_PERIOD} from './periods';
import {SectionList} from './sectionList';
import type {StatusGroupKey} from './statusGroups';
import {type OverviewView, SECTION_ORDER} from './types';

const BROWSER_TIMEZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

export default function AutofixOverview() {
  const organization = useOrganization();
  const location = useLocation();
  const navigate = useNavigate();

  const selectedId = decodeScalar(location.query.id);
  const period = decodeScalar(location.query.period) ?? DEFAULT_STATS_PERIOD;
  // Unknown or legacy sort values fall back to the default.
  const sort = decodeScalar(location.query.sort) === 'events' ? 'events' : 'activity';
  const assignee = decodeScalar(location.query.assignee);

  // Project scoping comes from the canonical page-filters selection; the
  // section requests are gated until the persisted selection is restored so
  // the first fetch doesn't race it with an all-projects query.
  const {selection, isReady: pageFiltersReady} = usePageFilters();

  const [collapsedGroups, setCollapsedGroups] = useLocalStorageState<StatusGroupKey[]>(
    'seer-autofix-overview:collapsed-groups',
    []
  );
  const [view, setView] = useLocalStorageState<OverviewView>(
    'seer-autofix-overview:view',
    storedValue => (storedValue === 'table' ? 'table' : 'cards')
  );

  const updateQuery = (patch: Record<string, string | string[] | undefined>) => {
    navigate(
      {pathname: location.pathname, query: {...location.query, ...patch}},
      {replace: true}
    );
  };
  const toggleGroup = (groupKey: StatusGroupKey, expanded: boolean) => {
    setCollapsedGroups(previous =>
      expanded
        ? previous.filter(key => key !== groupKey)
        : [...previous.filter(key => key !== groupKey), groupKey]
    );
  };
  const allGroupsCollapsed = SECTION_ORDER.every(key => collapsedGroups.includes(key));

  return (
    <Feature
      organization={organization}
      features="seer-night-shift-ui"
      renderDisabled={() => <NoAccess />}
    >
      <PageFiltersContainer skipInitializeUrlParams>
        <SentryDocumentTitle title={t('Autofix Overview')} orgSlug={organization.slug}>
          <Layout.Title>
            {t('Autofix Overview')}
            <InfoTip
              position="right"
              size="sm"
              title={t(
                'Issues where Autofix has produced a root cause, solution, code changes, or pull request.'
              )}
            />
          </Layout.Title>
          <TimezoneProvider timezone={BROWSER_TIMEZONE}>
            <Stack gap="lg" padding="lg xl">
              {selectedId ? (
                <FocusedIssue id={selectedId} period={period} />
              ) : (
                <Fragment>
                  <OverviewFilters
                    period={period}
                    sort={sort}
                    assignee={assignee}
                    view={view}
                    allCollapsed={allGroupsCollapsed}
                    onUpdateQuery={updateQuery}
                    onViewChange={setView}
                    onToggleAll={() =>
                      setCollapsedGroups(allGroupsCollapsed ? [] : [...SECTION_ORDER])
                    }
                  />
                  <SectionList
                    enabled={pageFiltersReady}
                    projects={selection.projects}
                    sort={sort}
                    period={period}
                    assignee={assignee}
                    view={view}
                    collapsedGroups={collapsedGroups}
                    onToggleGroup={toggleGroup}
                  />
                </Fragment>
              )}
            </Stack>
          </TimezoneProvider>
        </SentryDocumentTitle>
      </PageFiltersContainer>
    </Feature>
  );
}

function NoAccess() {
  return (
    <Stack flex={1} padding="2xl 3xl">
      <Alert.Container>
        <Alert variant="warning" showIcon={false}>
          {t("You don't have access to this feature")}
        </Alert>
      </Alert.Container>
    </Stack>
  );
}
