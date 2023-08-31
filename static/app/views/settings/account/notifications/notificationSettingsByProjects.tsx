import {Fragment} from 'react';
import type {WithRouterProps} from 'react-router';
import styled from '@emotion/styled';

import DeprecatedAsyncComponent from 'sentry/components/deprecatedAsyncComponent';
import EmptyMessage from 'sentry/components/emptyMessage';
import Form from 'sentry/components/forms/form';
import JsonForm from 'sentry/components/forms/jsonForm';
import Pagination from 'sentry/components/pagination';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {space} from 'sentry/styles/space';
import {Organization, Project} from 'sentry/types';
import {sortProjects} from 'sentry/utils';
import parseLinkHeader from 'sentry/utils/parseLinkHeader';
import withSentryRouter from 'sentry/utils/withSentryRouter';
import {
  MIN_PROJECTS_FOR_SEARCH,
  NotificationSettingsByProviderObject,
  NotificationSettingsObject,
} from 'sentry/views/settings/account/notifications/constants';
import {OrganizationSelectHeader} from 'sentry/views/settings/account/notifications/organizationSelectHeader';
import {
  getParentData,
  getParentField,
  groupByOrganization,
} from 'sentry/views/settings/account/notifications/utils';
import {RenderSearch} from 'sentry/views/settings/components/defaultSearchBar';

export type NotificationSettingsByProjectsBaseProps = {
  notificationSettings: NotificationSettingsObject;
  notificationType: string;
  onChange: (
    changedData: NotificationSettingsByProviderObject,
    parentId: string
  ) => NotificationSettingsObject;
  onSubmitSuccess: () => void;
};

type Props = {
  organizations: Organization[];
} & NotificationSettingsByProjectsBaseProps &
  DeprecatedAsyncComponent['props'] &
  WithRouterProps;

type State = {
  projects: Project[];
} & DeprecatedAsyncComponent['state'];

class NotificationSettingsByProjects extends DeprecatedAsyncComponent<Props, State> {
  getDefaultState(): State {
    return {
      ...super.getDefaultState(),
      projects: [],
    };
  }

  getEndpoints(): ReturnType<DeprecatedAsyncComponent['getEndpoints']> {
    const organizationId = this.getOrganizationId();
    return [
      [
        'projects',
        `/projects/`,
        {
          query: {
            organizationId,
            cursor: this.props.location.query.cursor,
          },
        },
      ],
    ];
  }

  getOrganizationId(): string | undefined {
    const {location, organizations} = this.props;
    const customerDomain = ConfigStore.get('customerDomain');
    const orgFromSubdomain = organizations.find(
      ({slug}) => slug === customerDomain?.subdomain
    )?.id;
    return location?.query?.organizationId ?? orgFromSubdomain ?? organizations[0]?.id;
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

  handleOrgChange = (organizationId: string) => {
    this.props.router.replace({
      ...this.props.location,
      query: {organizationId},
    });
  };

  renderBody() {
    const {notificationType, notificationSettings, onChange, onSubmitSuccess} =
      this.props;
    const {projects, projectsPageLinks} = this.state;

    const canSearch = this.getProjectCount() >= MIN_PROJECTS_FOR_SEARCH;
    const paginationObject = parseLinkHeader(projectsPageLinks ?? '');
    const hasMore = paginationObject?.next?.results;
    const hasPrevious = paginationObject?.previous?.results;

    const renderSearch: RenderSearch = ({defaultSearchBar}) => defaultSearchBar;
    const orgId = this.getOrganizationId();
    return (
      <Fragment>
        <Panel>
          <StyledPanelHeader>
            <OrganizationSelectHeader
              organizations={this.props.organizations}
              organizationId={orgId}
              handleOrgChange={this.handleOrgChange}
            />
            {canSearch &&
              this.renderSearchInput({
                stateKey: 'projects',
                url: `/projects/?organizationId=${orgId}`,
                placeholder: t('Search Projects'),
                children: renderSearch,
              })}
          </StyledPanelHeader>
          <PanelBody>
            <Form
              saveOnBlur
              apiMethod="PUT"
              apiEndpoint="/users/me/notification-settings/"
              initialData={getParentData(
                notificationType,
                notificationSettings,
                projects
              )}
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
        </Panel>
        {canSearch && (hasMore || hasPrevious) && (
          <Pagination pageLinks={projectsPageLinks} />
        )}
      </Fragment>
    );
  }
}

export default withSentryRouter(NotificationSettingsByProjects);

const StyledPanelHeader = styled(PanelHeader)`
  flex-wrap: wrap;
  gap: ${space(1)};
  & > form:last-child {
    flex-grow: 1;
  }
`;

export const StyledJsonForm = styled(JsonForm)`
  ${Panel} {
    border: 0;
    margin-bottom: 0;
  }
`;
