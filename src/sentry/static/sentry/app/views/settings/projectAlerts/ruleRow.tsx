import {Link} from 'react-router';
import {Params} from 'react-router/lib/Router';
import {PlainRoute} from 'react-router/lib/Route';
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import {Client} from 'app/api';
import {IssueAlertRule} from 'app/types/alerts';
import {Location} from 'history';
import {Panel, PanelBody, PanelHeader} from 'app/components/panels';
import {
  addSuccessMessage,
  addErrorMessage,
  addLoadingMessage,
  removeIndicator,
} from 'app/actionCreators/indicator';
import {getDisplayName} from 'app/utils/environment';
import {t, tct} from 'app/locale';
import Button from 'app/components/button';
import Confirm from 'app/components/confirm';
import Duration from 'app/components/duration';
import Tooltip from 'app/components/tooltip';
import recreateRoute from 'app/utils/recreateRoute';
import space from 'app/styles/space';

type Props = {
  api: Client;
  orgId: string;
  projectId: string;
  data: IssueAlertRule;

  // Callback when deleting a rule
  onDelete: () => void;

  // Is the alert rule editable?
  canEdit?: boolean;

  // react-router params
  params: Params;
  location: Location;
  routes: PlainRoute[];
};

type State = {
  loading: boolean;
  error: boolean;
};

class RuleRow extends React.Component<Props, State> {
  static propTypes: any = {
    api: PropTypes.object.isRequired,
    orgId: PropTypes.string.isRequired,
    projectId: PropTypes.string.isRequired,
    data: PropTypes.object.isRequired,
    onDelete: PropTypes.func.isRequired,
    canEdit: PropTypes.bool,
  };

  state = {loading: false, error: false};

  onDelete = () => {
    if (this.state.loading) {
      return;
    }

    const loadingIndicator = addLoadingMessage();
    const {api, orgId, projectId, data} = this.props;
    api.request(`/projects/${orgId}/${projectId}/rules/${data.id}/`, {
      method: 'DELETE',
      success: () => {
        this.props.onDelete();
        removeIndicator(loadingIndicator);
        addSuccessMessage(tct('Successfully deleted "[alert]"', {alert: data.name}));
      },
      error: () => {
        this.setState({
          error: true,
          loading: false,
        });
        removeIndicator(loadingIndicator);
        addErrorMessage(t('Unable to save changes. Please try again.'));
      },
    });
  };

  render() {
    const {data, canEdit} = this.props;
    const editLink = recreateRoute(`${data.id}/`, this.props);

    const environmentName = data.environment
      ? getDisplayName({name: data.environment})
      : t('All Environments');

    return (
      <Panel>
        <PanelHeader align="center" justify="space-between" hasButtons>
          <TextColorLink to={editLink}>
            {data.name} - {environmentName}
          </TextColorLink>

          <Actions>
            <Tooltip
              disabled={canEdit}
              title={t('You do not have permission to edit alert rules.')}
            >
              <Button
                data-test-id="edit-rule"
                disabled={!canEdit}
                size="xsmall"
                to={editLink}
              >
                {t('Edit Rule')}
              </Button>
            </Tooltip>

            <Tooltip
              disabled={canEdit}
              title={t('You do not have permission to edit alert rules.')}
            >
              <Confirm
                message={t('Are you sure you want to remove this rule?')}
                onConfirm={this.onDelete}
                disabled={!canEdit}
              >
                <Button size="xsmall" icon="icon-trash" />
              </Confirm>
            </Tooltip>
          </Actions>
        </PanelHeader>

        <PanelBody>
          <RuleDescriptionRow>
            <RuleDescriptionColumn>
              {data.conditions.length !== 0 && (
                <Condition>
                  <h6>
                    When <strong>{data.actionMatch}</strong> of these conditions are met:
                  </h6>
                  <table className="conditions-list table">
                    <tbody>
                      {data.conditions.map((condition, i) => {
                        return (
                          <tr key={i}>
                            <td>{condition.name}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </Condition>
              )}
            </RuleDescriptionColumn>
            <RuleDescriptionColumn>
              {data.actions.length !== 0 && (
                <Condition>
                  <h6>
                    Take these actions at most{' '}
                    <strong>
                      once every <Duration seconds={data.frequency * 60} />
                    </strong>{' '}
                    for an issue:
                  </h6>
                  <table className="actions-list table">
                    <tbody>
                      {data.actions.map((action, i) => {
                        return (
                          <tr key={i}>
                            <td>{action.name}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </Condition>
              )}
            </RuleDescriptionColumn>
          </RuleDescriptionRow>
        </PanelBody>
      </Panel>
    );
  }
}

export default RuleRow;

const TextColorLink = styled(Link)`
  color: ${p => p.theme.gray3};
`;

const RuleDescriptionRow = styled('div')`
  display: flex;
`;
const RuleDescriptionColumn = styled('div')`
  flex: 1;
  padding: ${p => p.theme.grid * 2}px;
  height: 100%;
`;
const Condition = styled('div')`
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  height: 100%;
`;

const Actions = styled('div')`
  display: grid;
  grid-auto-flow: column;
  grid-gap: ${space(1)};
  align-items: center;
`;
