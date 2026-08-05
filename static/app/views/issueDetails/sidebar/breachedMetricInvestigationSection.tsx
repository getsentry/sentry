import {useMemo} from 'react';

import {Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';
import {IssueCategory, type Group} from 'sentry/types/group';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {SidebarSectionTitle} from 'sentry/views/issueDetails/sidebar/sidebar';
import {BreachedMetricInvestigationAction} from 'sentry/views/issueList/pages/breachedMetricInvestigationAction';
import {BreachedMetricInvestigationStore} from 'sentry/views/issueList/pages/breachedMetricInvestigationStore';

export function BreachedMetricInvestigationSection({group}: {group: Group}) {
  const organization = useOrganization();
  const navigate = useNavigate();
  const store = useMemo(
    () => new BreachedMetricInvestigationStore(organization.slug, path => navigate(path)),
    [navigate, organization.slug]
  );
  const enabled =
    organization.features.includes('investigations') &&
    organization.features.includes('investigations-query-execution');

  if (!enabled || group.issueCategory !== IssueCategory.METRIC) {
    return null;
  }

  return (
    <Stack gap="md">
      <SidebarSectionTitle style={{margin: 0}}>{t('Investigation')}</SidebarSectionTitle>
      <Text variant="muted">
        {t('Use Seer to investigate what caused this metric to breach.')}
      </Text>
      <BreachedMetricInvestigationAction groupId={group.id} store={store} />
    </Stack>
  );
}
