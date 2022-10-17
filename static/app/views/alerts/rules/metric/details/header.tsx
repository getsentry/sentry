import {RouteComponentProps} from 'react-router';
import isPropValid from '@emotion/is-prop-valid';
import styled from '@emotion/styled';

import Breadcrumbs from 'sentry/components/breadcrumbs';
import Button from 'sentry/components/button';
import IdBadge from 'sentry/components/idBadge';
import PageHeading from 'sentry/components/pageHeading';
import {IconCopy, IconEdit} from 'sentry/icons';
import {t} from 'sentry/locale';
import {PageHeader} from 'sentry/styles/organization';
import space from 'sentry/styles/space';
import {Project} from 'sentry/types';
import {MetricRule} from 'sentry/views/alerts/rules/metric/types';

import {isIssueAlert} from '../../../utils';

type Props = Pick<RouteComponentProps<{orgId: string}, {}>, 'params'> & {
  hasMetricRuleDetailsError: boolean;
  project?: Project;
  rule?: MetricRule;
};

function DetailsHeader({hasMetricRuleDetailsError, rule, params, project}: Props) {
  const isRuleReady = !!rule && !hasMetricRuleDetailsError;
  const ruleTitle = rule && !hasMetricRuleDetailsError ? rule.name : '';
  const settingsLink =
    rule &&
    `/organizations/${params.orgId}/alerts/${
      isIssueAlert(rule) ? 'rules' : 'metric-rules'
    }/${project?.slug ?? rule?.projects?.[0]}/${rule.id}/`;

  const duplicateLink = {
    pathname: `/organizations/${params.orgId}/alerts/new/metric/`,
    query: {
      project: project?.slug,
      duplicateRuleId: rule?.id,
      createFromDuplicate: true,
      referrer: 'metric_rule_details',
    },
  };

  return (
    <Header>
      <BreadCrumbBar>
        <AlertBreadcrumbs
          crumbs={[
            {label: t('Alerts'), to: `/organizations/${params.orgId}/alerts/rules/`},
            {label: ruleTitle},
          ]}
        />
        <Controls>
          <Button size="sm" icon={<IconCopy />} to={duplicateLink}>
            {t('Duplicate')}
          </Button>
          <Button size="sm" icon={<IconEdit />} to={settingsLink}>
            {t('Edit Rule')}
          </Button>
        </Controls>
      </BreadCrumbBar>
      <Details>
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
      </Details>
    </Header>
  );
}

export default DetailsHeader;

const Header = styled('div')`
  background-color: ${p => p.theme.backgroundSecondary};
  border-bottom: 1px solid ${p => p.theme.border};
`;

const BreadCrumbBar = styled('div')`
  display: flex;
  margin-bottom: 0;
  padding: ${space(2)} ${space(4)} ${space(1)};
`;

const AlertBreadcrumbs = styled(Breadcrumbs)`
  flex-grow: 1;
  font-size: ${p => p.theme.fontSizeExtraLarge};
  padding: 0;
`;

const Controls = styled('div')`
  display: grid;
  grid-auto-flow: column;
  gap: ${space(1)};
`;

const Details = styled(PageHeader)`
  margin-bottom: 0;
  padding: ${space(1.5)} ${space(4)} ${space(2)};

  grid-template-columns: max-content auto;
  display: grid;
  gap: ${space(3)};
  grid-auto-flow: column;

  @media (max-width: ${p => p.theme.breakpoints.medium}) {
    grid-template-columns: auto;
    grid-auto-flow: row;
  }
`;

const RuleTitle = styled(PageHeading, {
  shouldForwardProp: p => typeof p === 'string' && isPropValid(p) && p !== 'loading',
})<{loading: boolean}>`
  ${p => p.loading && 'opacity: 0'};
  line-height: 1.5;
  display: grid;
  grid-template-columns: max-content 1fr;
  grid-column-gap: ${space(1)};
  align-items: center;
`;
