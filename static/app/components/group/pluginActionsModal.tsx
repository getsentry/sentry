import {Component, Fragment} from 'react';
import styled from '@emotion/styled';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {openModal} from 'sentry/actionCreators/modal';
import {TabList, Tabs} from 'sentry/components/core/tabs';
import {t, tct} from 'sentry/locale';
import plugins from 'sentry/plugins';
import {space} from 'sentry/styles/space';
import type {Group} from 'sentry/types/group';
import type {Plugin} from 'sentry/types/integrations';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {getAnalyticsDataForGroup} from 'sentry/utils/events';

export type TitledPlugin = Plugin & {
  // issue serializer adds more fields
  // TODO: should be able to use name instead of title
  title: string;
};

export function openPluginActionModal({
  project,
  group,
  organization,
  plugin,
  onModalClose,
}: {
  group: Group;
  onModalClose: (data?: any) => void;
  organization: Organization;
  plugin: TitledPlugin;
  project: Project;
}) {
  trackAnalytics('issue_details.external_issue_modal_opened', {
    organization,
    ...getAnalyticsDataForGroup(group),
    external_issue_provider: plugin.slug,
    external_issue_type: 'plugin',
  });

  openModal(
    deps => (
      <PluginActionsModal
        {...deps}
        project={project}
        group={group}
        organization={organization}
        plugin={plugin}
        onSuccess={onModalClose}
      />
    ),
    {onClose: onModalClose}
  );
}

type ModalProps = ModalRenderProps & {
  group: Group;
  onSuccess: (data: any) => void;
  organization: Organization;
  plugin: TitledPlugin;
  project: Project;
};

type ModalState = {
  actionType: 'create' | 'link' | null;
};

class PluginActionsModal extends Component<ModalProps, ModalState> {
  state: ModalState = {
    actionType: 'create',
  };

  render() {
    const {Header, Body, group, project, organization, plugin, onSuccess} = this.props;
    const {actionType} = this.state;

    return (
      <Fragment>
        <Header closeButton>
          <h4>{tct('[name] Issue', {name: plugin.name || plugin.title})}</h4>
        </Header>

        <TabsContainer>
          <Tabs
            value={this.state.actionType ?? 'create'}
            onChange={key => this.setState({actionType: key})}
          >
            <TabList>
              <TabList.Item key="create">{t('Create')}</TabList.Item>
              <TabList.Item key="link">{t('Link')}</TabList.Item>
            </TabList>
          </Tabs>
        </TabsContainer>

        {actionType && (
          // need the key here so React will re-render
          // with new action prop
          <Body key={actionType}>
            {plugins.get(plugin).renderGroupActions({
              plugin,
              group,
              project,
              organization,
              actionType,
              onSuccess: (...args) => {
                onSuccess(...args);
                this.props.closeModal();
              },
            })}
          </Body>
        )}
      </Fragment>
    );
  }
}

const TabsContainer = styled('div')`
  margin-bottom: ${space(2)};
`;
