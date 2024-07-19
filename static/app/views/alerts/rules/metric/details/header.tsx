import isPropValid from '@emotion/is-prop-valid';
import styled from '@emotion/styled';

import Access from 'sentry/components/acl/access';
import SnoozeAlert from 'sentry/components/alerts/snoozeAlert';
import {Breadcrumbs} from 'sentry/components/breadcrumbs';
import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import IdBadge from 'sentry/components/idBadge';
import * as Layout from 'sentry/components/layouts/thirds';
import {IconCopy, IconEdit} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import type {MetricRule} from 'sentry/views/alerts/rules/metric/types';
import {getAlertRuleActionCategory} from 'sentry/views/alerts/rules/utils';

import {isIssueAlert} from '../../../utils';

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

function DetailsHeader({
  hasMetricRuleDetailsError,
  rule,
  organization,
  project,
  onSnooze,
}: Props) {
  const isRuleReady = !!rule && !hasMetricRuleDetailsError;
  const ruleTitle = rule && !hasMetricRuleDetailsError ? rule.name : '';
  const settingsLink =
    rule &&
    `/organizations/${organization.slug}/alerts/${
      isIssueAlert(rule) ? 'rules' : 'metric-rules'
    }/${project?.slug ?? rule?.projects?.[0]}/${rule.id}/`;

  const duplicateLink = {
    pathname: `/organizations/${organization.slug}/alerts/new/metric/`,
    query: {
      project: project?.slug,
      duplicateRuleId: rule?.id,
      createFromDuplicate: true,
      referrer: 'metric_rule_details',
    },
  };

  const isSnoozed = rule?.snooze ?? false;

  return (
    <Layout.Header>
      <Layout.HeaderContent>
        <Breadcrumbs
          crumbs={[
            {label: t('Alerts'), to: `/organizations/${organization.slug}/alerts/rules/`},
            {label: ruleTitle},
          ]}
        />
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
      </Layout.HeaderContent>
      <Layout.HeaderActions>
        <ButtonBar gap={1}>
          {rule && project && (
            <Access access={['alerts:write']}>
              {({hasAccess}) => (
                <SnoozeAlert
                  isSnoozed={isSnoozed}
                  onSnooze={onSnooze}
                  ruleId={rule.id}
                  projectSlug={project.slug}
                  ruleActionCategory={getAlertRuleActionCategory(rule)}
                  hasAccess={hasAccess}
                  type="metric"
                />
              )}
            </Access>
          )}
          <Button size="sm" icon={<IconCopy />} to={duplicateLink}>
            {t('Duplicate')}
          </Button>
          <Button size="sm" icon={<IconEdit />} to={settingsLink}>
            {t('Edit Rule')}
          </Button>
        </ButtonBar>
      </Layout.HeaderActions>
    </Layout.Header>
  );
}

export default DetailsHeader;

const RuleTitle = styled(Layout.Title, {
  shouldForwardProp: p => typeof p === 'string' && isPropValid(p) && p !== 'loading',
})<{loading: boolean}>`
  ${p => p.loading && 'opacity: 0'};
`;
