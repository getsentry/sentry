import {Fragment} from 'react';

import AsyncComponent from 'sentry/components/asyncComponent';
import SelectControl from 'sentry/components/forms/controls/selectControl';
import {PanelHeader} from 'sentry/components/panels';
import {t} from 'sentry/locale';
import {Organization} from 'sentry/types';
import withOrganizations from 'sentry/utils/withOrganizations';
import NotificationSettingsByProjects, {
  Props as NotificationSettingsByProjectsProps,
} from 'sentry/views/settings/account/notifications/notificationSettingsByProjects';

type Props = {
  organizations: Organization[];
} & NotificationSettingsByProjectsProps &
  AsyncComponent['props'];

type State = {
  organizationId: string;
} & AsyncComponent['state'];

class NotificationSettingsByOrganizationByProjects extends AsyncComponent<Props, State> {
  getDefaultState(): State {
    return {
      ...super.getDefaultState(),
      organizationId: this.props.organizations[0].id,
    };
  }

  getOrganizationOptions() {
    return this.props.organizations.map(org => {
      return {
        label: org.name,
        value: org.id,
      };
    });
  }

  handleOrgChange = (option: {label: string; value: string}) => {
    this.setState({organization_id: option.value});
  };

  renderBody = () => {
    return (
      <Fragment>
        <PanelHeader>
          {t('Settings for Organization')}
          <SelectControl
            options={this.getOrganizationOptions()}
            onInputChange={this.handleOrgChange}
            getOptionValue={option => option.searchKey}
            value={this.state.organizationId}
            styles={{
              container: (provided: {[x: string]: string | number | boolean}) => ({
                ...provided,
                minWidth: `300px`,
              }),
            }}
            // isLoading={fetching}
            // {...extraProps}
          />
        </PanelHeader>
        <NotificationSettingsByProjects
          notificationType={this.props.notificationType}
          notificationSettings={this.props.notificationSettings}
          onChange={this.props.onChange}
          onSubmitSuccess={this.props.onSubmitSuccess}
          organizationId={this.state.organizationId}
        />
      </Fragment>
    );
  };
}

export default withOrganizations(NotificationSettingsByOrganizationByProjects);
