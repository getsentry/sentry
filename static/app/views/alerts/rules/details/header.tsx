import {Params} from 'react-router/lib/Router';
import isPropValid from '@emotion/is-prop-valid';
import styled from '@emotion/styled';

import Breadcrumbs from 'app/components/breadcrumbs';
import Button from 'app/components/button';
import PageHeading from 'app/components/pageHeading';
import {IconEdit} from 'app/icons';
import {t} from 'app/locale';
import {PageHeader} from 'app/styles/organization';
import space from 'app/styles/space';
import {IncidentRule} from 'app/views/alerts/incidentRules/types';

import {isIssueAlert} from '../../utils';

type Props = {
  hasIncidentRuleDetailsError: boolean;
  rule?: IncidentRule;
  params: Params;
};

function DetailsHeader({hasIncidentRuleDetailsError, rule, params}: Props) {
  const isRuleReady = !!rule && !hasIncidentRuleDetailsError;
  const project = rule?.projects?.[0];
  const settingsLink =
    rule &&
    `/organizations/${params.orgId}/alerts/${
      isIssueAlert(rule) ? 'rules' : 'metric-rules'
    }/${project}/${rule.id}/`;

  return (
    <Header>
      <BreadCrumbBar>
        <AlertBreadcrumbs
          crumbs={[
            {label: t('Alerts'), to: `/organizations/${params.orgId}/alerts/rules/`},
            {label: t('Alert Rule')},
          ]}
        />
        <Controls>
          <Button icon={<IconEdit />} to={settingsLink}>
            {t('Edit Rule')}
          </Button>
        </Controls>
      </BreadCrumbBar>
      <Details>
        <RuleTitle data-test-id="incident-rule-title" loading={!isRuleReady}>
          {rule && !hasIncidentRuleDetailsError ? rule.name : t('Loading')}
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
  grid-gap: ${space(1)};
`;

const Details = styled(PageHeader)`
  margin-bottom: 0;
  padding: ${space(1.5)} ${space(4)} ${space(2)};

  grid-template-columns: max-content auto;
  display: grid;
  grid-gap: ${space(3)};
  grid-auto-flow: column;

  @media (max-width: ${p => p.theme.breakpoints[1]}) {
    grid-template-columns: auto;
    grid-auto-flow: row;
  }
`;

const RuleTitle = styled(PageHeading, {
  shouldForwardProp: p => typeof p === 'string' && isPropValid(p) && p !== 'loading',
})<{loading: boolean}>`
  ${p => p.loading && 'opacity: 0'};
  line-height: 1.5;
`;
