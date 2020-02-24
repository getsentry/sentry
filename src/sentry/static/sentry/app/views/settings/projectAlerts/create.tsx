import {RouteComponentProps} from 'react-router/lib/Router';
import React from 'react';

import {Panel, PanelBody, PanelHeader} from 'app/components/panels';
import {t} from 'app/locale';
import AsyncView from 'app/views/asyncView';
import IssueEditor from 'app/views/settings/projectAlerts/issueEditor';
import IncidentRulesCreate from 'app/views/settings/incidentRules/create';
import PanelItem from 'app/components/panels/panelItem';
import RadioGroup from 'app/views/settings/components/forms/controls/radioGroup';
import routeTitleGen from 'app/utils/routeTitle';

type RouteParams = {
  orgId: string;
  projectId: string;
  incidentRuleId: string;
};

type Props = RouteComponentProps<RouteParams, {}> & {
  hasMetricAlerts: boolean;
};

type State = {
  alertType: string | null;
} & AsyncView['state'];

class Create extends AsyncView<Props, State> {
  getDefaultState() {
    const {pathname} = this.props.location;

    return {
      ...super.getDefaultState(),
      alertType: pathname.includes('/alerts/rules/')
        ? 'issue'
        : pathname.includes('/alerts/metric-rules/')
        ? 'metric'
        : null,
    };
  }

  getTitle() {
    return routeTitleGen(t('New Alert'), this.props.params.projectId, false);
  }

  getEndpoints(): [string, string][] {
    return [];
  }

  handleChangeAlertType = (alertType: string) => {
    // alertType should be `issue` or `metric`
    this.setState({
      alertType,
    });
  };

  renderLoading() {
    return this.renderBody();
  }

  renderBody() {
    const {hasMetricAlerts} = this.props;
    const {alertType} = this.state;

    const shouldShowAlertTypeChooser = hasMetricAlerts;

    return (
      <React.Fragment>
        {shouldShowAlertTypeChooser && (
          <Panel>
            <PanelHeader>{t('Choose an Alert Type')}</PanelHeader>
            <PanelBody>
              <PanelItem>
                <RadioGroup
                  label={t('Select an Alert Type')}
                  value={this.state.alertType}
                  choices={[
                    [
                      'metric',
                      t('Metric Alert'),
                      t(
                        'Metric alerts allow you to filter and set thresholds on errors. They can be used for high-level monitoring of patterns, or fine-grained monitoring of individual events.'
                      ),
                    ],
                    [
                      'issue',
                      t('Issue Alert'),
                      t(
                        'Issue alerts fire whenever any issue in the project matches your specified criteria, such as a resolved issue re-appearing or an issue affecting many users.'
                      ),
                    ],
                  ]}
                  onChange={this.handleChangeAlertType}
                />
              </PanelItem>
            </PanelBody>
          </Panel>
        )}

        {(!hasMetricAlerts || alertType === 'issue') && <IssueEditor {...this.props} />}

        {hasMetricAlerts && alertType === 'metric' && (
          <IncidentRulesCreate {...this.props} />
        )}
      </React.Fragment>
    );
  }
}

export default Create;
