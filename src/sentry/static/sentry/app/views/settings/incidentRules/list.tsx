import {Link} from 'react-router';
import {RouteComponentProps} from 'react-router/lib/Router';
import styled from '@emotion/styled';
import {css} from '@emotion/core';

import {Panel, PanelBody, PanelHeader, PanelItem} from 'app/components/panels';
import {t} from 'app/locale';
import AsyncView from 'app/views/asyncView';
import Button from 'app/components/button';
import Confirm from 'app/components/confirm';
import EmptyMessage from 'app/views/settings/components/emptyMessage';
import LoadingIndicator from 'app/components/loadingIndicator';
import {IconDelete, IconEdit} from 'app/icons';
import recreateRoute from 'app/utils/recreateRoute';
import space from 'app/styles/space';

import {SavedIncidentRule} from './types';
import {deleteRule} from './actions';

type State = {
  rules: SavedIncidentRule[];
} & AsyncView['state'];

type RouteParams = {
  orgId: string;
  projectId: string;
};

type Props = RouteComponentProps<RouteParams, {}>;

class IncidentRulesList extends AsyncView<Props, State> {
  getEndpoints() {
    const {orgId} = this.props.params;

    return [['rules', `/organizations/${orgId}/alert-rules/`] as [string, string]];
  }

  handleRemoveRule = async (rule: SavedIncidentRule) => {
    const {orgId} = this.props.params;

    // Optimistic update
    const oldRules = this.state.rules.slice(0);

    const newRules = this.state.rules.filter(({id}) => id !== rule.id);

    try {
      this.setState({
        rules: newRules,
      });

      await deleteRule(this.api, orgId, rule);
    } catch (_err) {
      this.setState({
        rules: oldRules,
      });
    }
  };

  renderLoading() {
    return this.renderBody();
  }

  renderBody() {
    const isLoading = this.state.loading;
    const isEmpty = !isLoading && !this.state.rules.length;

    return (
      <Panel>
        <GridPanelHeader>
          <NameColumn>{t('Name')}</NameColumn>

          <div>{t('Metric')}</div>

          <div>{t('Threshold')}</div>
        </GridPanelHeader>

        <PanelBody>
          {isLoading && <LoadingIndicator />}

          {!isLoading &&
            !isEmpty &&
            this.state.rules.map(rule => {
              const ruleLink = recreateRoute(`${rule.id}/`, this.props);
              return (
                <RuleRow key={rule.id}>
                  <RuleLink to={ruleLink}>{rule.name}</RuleLink>

                  <MetricName>{rule.aggregate}</MetricName>

                  <ThresholdColumn>
                    <Thresholds>
                      {rule.triggers.map(trigger => trigger.alertThreshold).join(', ')}
                    </Thresholds>

                    <Actions>
                      <Button to={ruleLink} size="small" aria-label={t('Edit Rule')}>
                        <IconEdit size="xs" />
                        &nbsp;
                        {t('Edit')}
                      </Button>

                      <Confirm
                        priority="danger"
                        onConfirm={() => this.handleRemoveRule(rule)}
                        message={t('Are you sure you want to remove this rule?')}
                      >
                        <Button
                          type="button"
                          size="small"
                          icon={<IconDelete />}
                          label={t('Remove Rule')}
                        />
                      </Confirm>
                    </Actions>
                  </ThresholdColumn>
                </RuleRow>
              );
            })}

          {!isLoading && isEmpty && (
            <EmptyMessage>{t('No Alert Rules have been created yet.')}</EmptyMessage>
          )}
        </PanelBody>
      </Panel>
    );
  }
}

export default IncidentRulesList;

const gridCss = css`
  display: grid;
  grid-template-columns: 3fr 1fr 2fr;
  align-items: center;
`;

const nameColumnCss = css`
  padding: ${space(2)};
`;

const GridPanelHeader = styled(PanelHeader)`
  padding: 0;
  ${gridCss};
`;

const RuleRow = styled(PanelItem)`
  padding: 0;
  align-items: center;
  ${gridCss};
`;

const NameColumn = styled('div')`
  ${nameColumnCss};
`;

const RuleLink = styled(Link)`
  ${nameColumnCss}
`;

// For tests
const MetricName = styled('div')``;

const ThresholdColumn = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

// For tests
const Thresholds = styled('div')``;

const Actions = styled('div')`
  display: grid;
  grid-auto-flow: column;
  grid-gap: ${space(1)};
  margin: ${space(2)};
`;
