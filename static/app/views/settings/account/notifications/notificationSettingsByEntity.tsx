import {Fragment} from 'react';
import type {WithRouterProps} from 'react-router';
import {components} from 'react-select';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import DeprecatedAsyncComponent from 'sentry/components/deprecatedAsyncComponent';
import SelectControl from 'sentry/components/forms/controls/selectControl';
import JsonForm from 'sentry/components/forms/jsonForm';
import IdBadge from 'sentry/components/idBadge';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import {IconAdd, IconDelete} from 'sentry/icons';
import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {space} from 'sentry/styles/space';
import {Organization, Project} from 'sentry/types';
import withSentryRouter from 'sentry/utils/withSentryRouter';
import {NotificationOptionsObject} from 'sentry/views/settings/account/notifications/constants';
import {NOTIFICATION_SETTING_FIELDS} from 'sentry/views/settings/account/notifications/fields2';
import {OrganizationSelectHeader} from 'sentry/views/settings/account/notifications/organizationSelectHeader';

type Value = 'always' | 'never' | 'subscribe_only' | 'committed_only';

const getLabelForValue = (value: Value) => {
  switch (value) {
    case 'always':
      return t('On');
    case 'never':
      return t('Off');
    case 'subscribe_only':
      return t('Subscribed Only');
    case 'committed_only':
      return t('Committed Only');
    default:
      return '';
  }
};

export type NotificationSettingsByProjectsBaseProps = {
  entity: 'project' | 'organization';
  handleAddNotificationOption: (notificationOption: NotificationOptionsObject) => void;
  handleRemoveNotificationOption: (
    notificationOption: Pick<
      NotificationOptionsObject,
      'notificationType' | 'scopeType' | 'scopeIdentifier'
    >
  ) => void;
  notificationOptions: NotificationOptionsObject[];
  notificationType: string;
  onSubmitSuccess: () => void;
};

type Props = {
  organizations: Organization[];
} & NotificationSettingsByProjectsBaseProps &
  DeprecatedAsyncComponent['props'] &
  WithRouterProps;

type State = {
  entities: Project[] | Organization[];
  selectedEntityId: string | null;
  selectedValue: Value | null;
} & DeprecatedAsyncComponent['state'];

class NotificationSettingsByEntity extends DeprecatedAsyncComponent<Props, State> {
  getDefaultState(): State {
    return {
      ...super.getDefaultState(),
      selectedEntityId: null,
      selectedValue: null,
      entities: [],
    };
  }

  getEndpoints(): ReturnType<DeprecatedAsyncComponent['getEndpoints']> {
    const organizationId = this.getOrganizationId();
    const endpoint = this.props.entity === 'project' ? '/projects/' : '/organizations/';
    return [
      [
        'entities',
        endpoint,
        {
          query: {
            organizationId,
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

  getInitialData() {
    return {};
  }

  handleOrgChange = (organizationId: string) => {
    this.props.router.replace({
      ...this.props.location,
      query: {organizationId},
    });
  };

  handleAdd = async () => {
    const {selectedEntityId, selectedValue} = this.state;
    // should never happen
    if (!selectedEntityId || !selectedValue) {
      return;
    }
    const data = {
      notificationType: this.props.notificationType,
      scopeType: this.props.entity,
      scopeIdentifier: selectedEntityId,
      value: selectedValue,
    };
    await this.api.requestPromise('/users/me/notification-options/', {
      method: 'PUT',
      data,
    });
    this.setState({selectedEntityId: null, selectedValue: null});
    this.props.handleAddNotificationOption(data);
  };

  renderOverrides() {
    const {notificationOptions} = this.props;
    const {entities} = this.state;
    const matchedOptions = notificationOptions.filter(
      option =>
        option.notificationType === this.props.notificationType &&
        option.scopeType === this.props.entity
    );
    return matchedOptions.map(option => {
      const entity = (entities as any[]).find(
        ({id}) => id.toString() === option.scopeIdentifier.toString()
      );
      if (!entity) {
        return null;
      }
      const data = {
        notificationType: this.props.notificationType,
        scopeType: this.props.entity,
        scopeIdentifier: option.scopeIdentifier,
      };
      const handleDelete = async () => {
        await this.api.requestPromise('/users/me/notification-options/', {
          method: 'DELETE',
          data,
        });
        this.props.handleRemoveNotificationOption(data);
      };
      const idBadgeProps =
        this.props.entity === 'project'
          ? {project: entity}
          : {
              organization: entity,
            };
      return (
        <Item key={entity.id}>
          <IdBadge
            {...idBadgeProps}
            avatarSize={20}
            displayName={entity.slug}
            avatarProps={{consistentWidth: true}}
            disableLink
          />
          {getLabelForValue(option.value)}
          <Button
            aria-label={t('Delete')}
            size="sm"
            priority="primary"
            icon={<IconDelete />}
            onClick={() => handleDelete()}
          />
        </Item>
      );
    });
  }

  renderBody() {
    const {notificationType, notificationOptions} = this.props;
    const {entities, selectedEntityId, selectedValue} = this.state;

    const orgId = this.getOrganizationId();
    // create maps by the project id for constant time lookups
    const entityById = Object.fromEntries(entities.map(entity => [entity.id, entity]));
    const entityOptions: {label: string; value: Value}[] = (entities as any[])
      .filter(({id}: Project | Organization) => {
        const match = notificationOptions.find(
          option =>
            option.scopeType === this.props.entity &&
            option.scopeIdentifier.toString() === id.toString() &&
            option.notificationType === notificationType
        );
        return !match;
      })
      .map(({slug, id}) => ({label: slug, value: id}));
    const customOptionProject = entityProps => {
      const entity = entityById[entityProps.value];
      // Should never happen for a dropdown item
      if (!entity) {
        return null;
      }
      const idBadgeProps =
        this.props.entity === 'project'
          ? {project: entity}
          : {
              organization: entity,
            };
      return (
        <components.Option {...entityProps}>
          <IdBadge
            {...idBadgeProps}
            avatarSize={20}
            displayName={entity.slug}
            avatarProps={{consistentWidth: true}}
            disableLink
          />
        </components.Option>
      );
    };

    const customValueContainer = containerProps => {
      // if no value set, we want to return the default component that is rendered
      const entity = entityById[selectedEntityId || ''];
      if (!entity) {
        return <components.ValueContainer {...containerProps} />;
      }
      const idBadgeProps =
        this.props.entity === 'project'
          ? {project: entity}
          : {
              organization: entity,
            };
      return (
        <components.ValueContainer {...containerProps}>
          <IdBadge
            {...idBadgeProps}
            avatarSize={20}
            displayName={entity.slug}
            avatarProps={{consistentWidth: true}}
            disableLink
          />
        </components.ValueContainer>
      );
    };

    const handleSelectProject = ({value}: {value: string}) => {
      this.setState({selectedEntityId: value});
    };
    const handleSelectValue = ({value}: {value: string}) => {
      this.setState({selectedValue: value as Value});
    };

    const valueOptions = NOTIFICATION_SETTING_FIELDS[notificationType].choices;

    return (
      <Fragment>
        <Panel>
          <StyledPanelHeader>
            <OrganizationSelectHeader
              organizations={this.props.organizations}
              organizationId={orgId}
              handleOrgChange={this.handleOrgChange}
            />
          </StyledPanelHeader>
          <Item>
            {/* TODO: enable search for sentry projects */}
            <SelectControl
              placeholder={
                this.props.entity === 'project'
                  ? t('Sentry project\u2026')
                  : t('Sentry organization\u2026')
              }
              name={this.props.entity}
              options={entityOptions}
              components={{
                Option: customOptionProject,
                ValueContainer: customValueContainer,
              }}
              onChange={handleSelectProject}
              value={selectedEntityId}
            />
            <SelectControl
              value={selectedValue}
              name="value"
              choices={valueOptions}
              onChange={handleSelectValue}
            />
            <AddProjectWrapper>
              <Button
                disabled={!selectedEntityId || !selectedValue}
                size="sm"
                priority="primary"
                onClick={this.handleAdd}
                icon={<IconAdd />}
                aria-label={t('Add override')}
              />
            </AddProjectWrapper>
          </Item>
          <PanelBody>{this.renderOverrides()}</PanelBody>
        </Panel>
      </Fragment>
    );
  }
}

export default withSentryRouter(NotificationSettingsByEntity);

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

const AddProjectWrapper = styled('div')``;

const Item = styled('div')`
  min-height: 60px;
  padding: ${space(2)};

  display: grid;
  grid-column-gap: ${space(1)};
  align-items: center;
  grid-template-columns: 2.5fr 1fr min-content;
`;
