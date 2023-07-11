import {Fragment} from 'react';
import styled from '@emotion/styled';

import AsyncComponent from 'sentry/components/asyncComponent';
import EmptyMessage from 'sentry/components/emptyMessage';
import Form from 'sentry/components/forms/form';
import JsonForm from 'sentry/components/forms/jsonForm';
import Pagination from 'sentry/components/pagination';
import {Panel, PanelBody, PanelHeader} from 'sentry/components/panels';
import {t} from 'sentry/locale';
import {Organization, Project} from 'sentry/types';
import {sortProjects} from 'sentry/utils';
import {
  MIN_PROJECTS_FOR_PAGINATION,
  MIN_PROJECTS_FOR_SEARCH,
  NotificationSettingsByProviderObject,
  NotificationSettingsObject,
} from 'sentry/views/settings/account/notifications/constants';
import {OrganizationSelectHeader} from 'sentry/views/settings/account/notifications/notificationSettingsByType';
import {
  getParentData,
  getParentField,
  groupByOrganization,
} from 'sentry/views/settings/account/notifications/utils';
import {
  RenderSearch,
  SearchWrapper,
} from 'sentry/views/settings/components/defaultSearchBar';

export type NotificationSettingsByProjectsBaseProps = {
  notificationSettings: NotificationSettingsObject;
  notificationType: string;
  onChange: (
    changedData: NotificationSettingsByProviderObject,
    parentId: string
  ) => NotificationSettingsObject;
  onSubmitSuccess: () => void;
};
export type Props = {
  handleOrgChange: Function;
  organizationId: string;
  organizations: Organization[];
} & NotificationSettingsByProjectsBaseProps &
  AsyncComponent['props'];

type State = {
  projects: Project[];
} & AsyncComponent['state'];

class NotificationSettingsByProjects extends AsyncComponent<Props, State> {
  getDefaultState(): State {
    return {
      ...super.getDefaultState(),
      projects: [],
    };
  }

  getEndpoints(): ReturnType<AsyncComponent['getEndpoints']> {
    return [
      [
        'projects',
        `/projects/`,
        {
          query: {organizationId: this.props.organizationId},
        },
      ],
    ];
  }

  /**
   * Check the notification settings for how many projects there are.
   */
  getProjectCount = (): number => {
    const {notificationType, notificationSettings} = this.props;

    return Object.values(notificationSettings[notificationType]?.project || {}).length;
  };

  /**
   * The UI expects projects to be grouped by organization but can also use
   * this function to make a single group with all organizations.
   */
  getGroupedProjects = (): {[key: string]: Project[]} => {
    const {projects: stateProjects} = this.state;

    return Object.fromEntries(
      Object.values(groupByOrganization(sortProjects(stateProjects))).map(
        ({organization, projects}) => [`${organization.name} Projects`, projects]
      )
    );
  };

  handleOrgChange = (option: {label: string; value: string}) => {
    // handleOrgChange(option: {label: string; value: string}) {
    const self = this;
    this.props.handleOrgChange(option);
    setTimeout(() => self.reloadData(), 0);
  };

  renderBody() {
    const {notificationType, notificationSettings, onChange, onSubmitSuccess} =
      this.props;
    const {projects, projectsPageLinks} = this.state;

    const canSearch = this.getProjectCount() >= MIN_PROJECTS_FOR_SEARCH;
    const shouldPaginate = projects.length >= MIN_PROJECTS_FOR_PAGINATION;

    const renderSearch: RenderSearch = ({defaultSearchBar}) => (
      <StyledSearchWrapper>{defaultSearchBar}</StyledSearchWrapper>
    );

    return (
      <Fragment>
        <PanelHeader>
          <OrganizationSelectHeader
            organizations={this.props.organizations}
            organizationId={this.props.organizationId}
            handleOrgChange={this.handleOrgChange}
          />

          {canSearch &&
            this.renderSearchInput({
              stateKey: 'projects',
              url: `/projects/?organizationId=${this.props.organizationId}`,
              placeholder: t('Search Projects'),
              children: renderSearch,
            })}
        </PanelHeader>
        <PanelBody>
          <Form
            saveOnBlur
            apiMethod="PUT"
            apiEndpoint="/users/me/notification-settings/"
            initialData={getParentData(notificationType, notificationSettings, projects)}
            onSubmitSuccess={onSubmitSuccess}
          >
            {projects.length === 0 ? (
              <EmptyMessage>{t('No projects found')}</EmptyMessage>
            ) : (
              Object.entries(this.getGroupedProjects()).map(([groupTitle, parents]) => (
                <StyledJsonForm
                  collapsible
                  key={groupTitle}
                  // title={groupTitle}
                  fields={parents.map(parent =>
                    getParentField(
                      notificationType,
                      notificationSettings,
                      parent,
                      onChange
                    )
                  )}
                />
              ))
            )}
          </Form>
        </PanelBody>
        {canSearch && shouldPaginate && (
          <Pagination pageLinks={projectsPageLinks} {...this.props} />
        )}
      </Fragment>
    );
  }
}

export default NotificationSettingsByProjects;

const StyledSearchWrapper = styled(SearchWrapper)`
  * {
    width: 100%;
  }
`;

export const StyledJsonForm = styled(JsonForm)`
  ${Panel} {
    border: 0;
    margin-bottom: 0;
  }
`;
