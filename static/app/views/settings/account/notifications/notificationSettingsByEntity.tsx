import {Fragment, useState} from 'react';
import type {WithRouterProps} from 'react-router';
import {components} from 'react-select';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
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
import {useApiQuery} from 'sentry/utils/queryClient';
import withSentryRouter from 'sentry/utils/withSentryRouter';
import {NotificationOptionsObject} from 'sentry/views/settings/account/notifications/constants';
import {NOTIFICATION_SETTING_FIELDS_V2} from 'sentry/views/settings/account/notifications/fields2';
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
  entityType: 'project' | 'organization';
  handleAddNotificationOption: (
    notificationOption: Omit<NotificationOptionsObject, 'id'>
  ) => void;
  handleRemoveNotificationOption: (id: string) => void;
  notificationOptions: NotificationOptionsObject[];
  notificationType: string;
};

type Props = {
  organizations: Organization[];
} & NotificationSettingsByProjectsBaseProps &
  WithRouterProps;

function NotificationSettingsByEntity(props: Props) {
  const {
    entityType,
    handleAddNotificationOption,
    handleRemoveNotificationOption,
    notificationOptions,
    notificationType,
    organizations,
    router,
    location,
  } = props;
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [selectedValue, setSelectedValue] = useState<Value | null>(null);

  const customerDomain = ConfigStore.get('customerDomain');
  const orgFromSubdomain = organizations.find(
    ({slug}) => slug === customerDomain?.subdomain
  )?.id;

  const orgId =
    location?.query?.organizationId ?? orgFromSubdomain ?? organizations[0]?.id;
  const orgSlug =
    organizations.find(({id}) => id === orgId)?.slug || organizations[0]?.slug;

  // loads all the projects for an org
  const {data: projects} = useApiQuery<Project[]>(
    [
      `/organizations/${orgSlug}/projects/`,
      {
        query: {
          all_projects: '1',
          collapse: 'latestDeploys',
        },
      },
    ],
    {staleTime: Infinity}
  );

  // always loading all projects even though we only need it sometimes
  const entities = entityType === 'project' ? projects || [] : organizations;

  const handleOrgChange = (organizationId: string) => {
    router.replace({
      ...location,
      query: {organizationId},
    });
  };

  const handleAdd = () => {
    // should never happen
    if (!selectedEntityId || !selectedValue) {
      return;
    }
    const data = {
      type: notificationType,
      scopeType: entityType,
      scopeIdentifier: selectedEntityId,
      value: selectedValue,
    };
    setSelectedEntityId(null);
    setSelectedValue(null);
    handleAddNotificationOption(data);
  };

  const renderOverrides = () => {
    const matchedOptions = notificationOptions.filter(
      option => option.type === notificationType && option.scopeType === entityType
    );
    return matchedOptions.map(option => {
      const entity = (entities as any[]).find(
        ({id}) => id.toString() === option.scopeIdentifier.toString()
      );
      if (!entity) {
        return null;
      }
      const handleDelete = async (id: string) => {
        await handleRemoveNotificationOption(id);
      };
      const idBadgeProps =
        entityType === 'project'
          ? {project: entity as Project}
          : {
              organization: entity as Organization,
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
            priority="default"
            icon={<IconDelete />}
            onClick={() => handleDelete(option.id)}
          />
        </Item>
      );
    });
  };

  const customValueContainer = containerProps => {
    // if no value set, we want to return the default component that is rendered
    const entity = entityById[selectedEntityId || ''];
    if (!entity) {
      return <components.ValueContainer {...containerProps} />;
    }
    const idBadgeProps =
      entityType === 'project'
        ? {project: entity as Project}
        : {
            organization: entity as Organization,
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
    setSelectedEntityId(value);
  };
  const handleSelectValue = ({value}: {value: string}) => {
    setSelectedValue(value as Value);
  };

  // create maps by the project id for constant time lookups
  const entityById: Record<string, Organization | Project> = Object.fromEntries(
    entities.map(entity => [entity.id, entity])
  );
  const entityOptions: {label: string; value: Value}[] = (entities as any[])
    .filter(({id}: Project | Organization) => {
      const match = notificationOptions.find(
        option =>
          option.scopeType === entityType &&
          option.scopeIdentifier.toString() === id.toString() &&
          option.type === notificationType
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
      entityType === 'project'
        ? {project: entity as Project}
        : {
            organization: entity as Organization,
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

  const valueOptions = NOTIFICATION_SETTING_FIELDS_V2[notificationType].choices;
  return (
    <Fragment>
      <Panel>
        <StyledPanelHeader>
          {entityType === 'project' ? (
            <OrganizationSelectHeader
              organizations={organizations}
              organizationId={orgId}
              handleOrgChange={handleOrgChange}
            />
          ) : (
            t('Settings for Organizations')
          )}
        </StyledPanelHeader>
        <Item>
          {/* TODO: enable search for sentry projects */}
          <SelectControl
            placeholder={
              entityType === 'project'
                ? t('Sentry project\u2026')
                : t('Sentry organization\u2026')
            }
            name={entityType}
            options={entityOptions}
            components={{
              Option: customOptionProject,
              ValueContainer: customValueContainer,
            }}
            onChange={handleSelectProject}
            value={selectedEntityId}
          />
          <SelectControl
            placeholder={t('Select\u2026')}
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
              onClick={handleAdd}
              icon={<IconAdd />}
              aria-label={t('Add override')}
            />
          </AddProjectWrapper>
        </Item>
        <PanelBody>{renderOverrides()}</PanelBody>
      </Panel>
    </Fragment>
  );
}

// loading all projects and orgs
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
