import {Fragment} from 'react';

import AsyncComponent from 'sentry/components/asyncComponent';
import SelectControl from 'sentry/components/forms/controls/selectControl';
import {PanelHeader} from 'sentry/components/panels';
import {t} from 'sentry/locale';
import {Organization} from 'sentry/types';
import NotificationSettingsByProjects, {
  NotificationSettingsByProjectsBaseProps,
} from 'sentry/views/settings/account/notifications/notificationSettingsByProjects';

type OrganizationSelectHeaderProps = {
  handleOrgChange: Function;
  organizationId: string;
  organizations: Organization[];
};

export function OrganizationSelectHeader({
  handleOrgChange,
  organizationId,
  organizations,
}: OrganizationSelectHeaderProps) {
  const getOrganizationOptions = () => {
    return organizations.map(org => {
      return {
        label: org.name,
        value: org.id,
      };
    });
  };

  return (
    <PanelHeader>
      {t('Settings for Organization')}
      <SelectControl
        options={getOrganizationOptions()}
        onInputChange={handleOrgChange}
        getOptionValue={option => option.searchKey}
        value={organizationId}
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
  );
}

type Props = {
  organizations: Organization[];
} & NotificationSettingsByProjectsBaseProps &
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

  handleOrgChange = (option: {label: string; value: string}) => {
    this.setState({organizationId: option.value});
  };

  renderBody = () => {
    return (
      <Fragment>
        <OrganizationSelectHeader
          organizations={this.props.organizations}
          organizationId={this.state.organizationId}
          handleOrgChange={this.handleOrgChange}
        />
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

export default NotificationSettingsByOrganizationByProjects;
