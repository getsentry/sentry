import styled from '@emotion/styled';

import {LinkButton} from '@sentry/scraps/button';

import {Access} from 'sentry/components/acl/access';
import {SnoozeAlert} from 'sentry/components/alerts/snoozeAlert';
import {Breadcrumbs} from 'sentry/components/breadcrumbs';
import {IdBadge} from 'sentry/components/idBadge';
import * as Layout from 'sentry/components/layouts/thirds';
import {IconCopy, IconEdit} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {makeAlertsPathname} from 'sentry/views/alerts/pathnames';
import type {MetricRule} from 'sentry/views/alerts/rules/metric/types';
import {
  AlertWizardAlertNames,
  DEPRECATED_TRANSACTION_ALERTS,
} from 'sentry/views/alerts/wizard/options';
import {getAlertTypeFromAggregateDataset} from 'sentry/views/alerts/wizard/utils';
import {
  deprecateTransactionAlerts,
  hasEAPAlerts,
} from 'sentry/views/insights/common/utils/hasEAPAlerts';
import {TopBar} from 'sentry/views/navigation/topBar';

type Props = {
  hasMetricRuleDetailsError: boolean;
  onSnooze: (nextState: {
    snooze: boolean;
    snoozeCreatedBy?: string;
    snoozeForEveryone?: boolean;
  }) => void;
  organization: Organization;
  project?: Project;
  rule?: MetricRule;
};

export function DetailsHeader({
  hasMetricRuleDetailsError,
  rule,
  organization,
  project,
  onSnooze,
}: Props) {
  const isRuleReady = !!rule && !hasMetricRuleDetailsError;
  const ruleTitle = rule && !hasMetricRuleDetailsError ? rule.name : '';
  const settingsLink = rule
    ? makeAlertsPathname({
        path: `/metric-rules/${project?.slug ?? rule?.projects?.[0]}/${rule.id}/`,
        organization,
      })
    : '#';

  const duplicateLink = {
    pathname: makeAlertsPathname({
      path: '/new/metric/',
      organization,
    }),
    query: {
      project: project?.slug,
      duplicateRuleId: rule?.id,
      createFromDuplicate: 'true',
      referrer: 'metric_rule_details',
    },
  };

  const ruleType =
    rule &&
    getAlertTypeFromAggregateDataset({
      aggregate: rule.aggregate,
      dataset: rule.dataset,
      eventTypes: rule.eventTypes,
      organization,
    });

  const deprecateTransactionsAlerts =
    deprecateTransactionAlerts(organization) &&
    ruleType &&
    DEPRECATED_TRANSACTION_ALERTS.includes(ruleType);

  return (
    <Layout.Header>
      <Layout.HeaderContent>
        <Breadcrumbs
          crumbs={[
            {
              label: t('Alerts'),
              to: makeAlertsPathname({
                path: '/rules/',
                organization,
              }),
            },
            {
              label: ruleType
                ? t('%s Metric Alert', AlertWizardAlertNames[ruleType])
                : t('Metric Alert'),
            },
          ]}
        />
        <Layout.Title>
          <RuleTitle data-test-id="incident-rule-title" loading={!isRuleReady}>
            {project && (
              <IdBadge
                project={project}
                avatarSize={28}
                hideName
                avatarProps={{hasTooltip: true, tooltip: project.slug}}
              />
            )}
            {ruleTitle}
          </RuleTitle>
        </Layout.Title>
      </Layout.HeaderContent>
      <TopBar.Slot name="actions">
        {rule && project && (
          <Access access={['alerts:write']}>
            {({hasAccess}) => (
              <SnoozeAlert
                isSnoozed={rule?.snoozeForEveryone ?? false}
                onSnooze={onSnooze}
                ruleId={rule.id}
                projectSlug={project.slug}
                hasAccess={hasAccess}
                type="metric"
              />
            )}
          </Access>
        )}
        <LinkButton
          icon={<IconCopy />}
          to={duplicateLink}
          disabled={deprecateTransactionsAlerts}
          tooltipProps={{
            title: deprecateTransactionsAlerts
              ? hasEAPAlerts(organization)
                ? t(
                    'Transaction alerts are being deprecated. Please create Span alerts instead.'
                  )
                : t('Transaction alerts are being deprecated.')
              : undefined,
          }}
        >
          {t('Duplicate')}
        </LinkButton>
        <LinkButton icon={<IconEdit />} to={settingsLink}>
          {t('Edit Rule')}
        </LinkButton>
      </TopBar.Slot>
    </Layout.Header>
  );
}

const RuleTitle = styled('div', {
  shouldForwardProp: p => p !== 'loading',
})<{loading: boolean}>`
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.md};
  min-width: 0;
  ${p => p.loading && 'opacity: 0'};
`;
