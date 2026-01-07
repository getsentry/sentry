import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import {openModal, type ModalRenderProps} from 'sentry/actionCreators/modal';
import {TabList, Tabs} from 'sentry/components/core/tabs';
import SentryAppExternalIssueForm from 'sentry/components/group/sentryAppExternalIssueForm';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {SentryAppComponent, SentryAppInstallation} from 'sentry/types/integrations';
import type {Organization} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import {getAnalyticsDataForGroup} from 'sentry/utils/events';
import {recordInteraction} from 'sentry/utils/recordSentryAppInteraction';

interface OpenSentryAppIssueModalProps
  extends Omit<Props, keyof ModalRenderProps | 'disabled'> {
  organization: Organization;
}

export const openSentryAppIssueModal = ({
  organization,
  group,
  event,
  sentryAppComponent,
  sentryAppInstallation,
}: OpenSentryAppIssueModalProps) => {
  trackAnalytics('issue_details.external_issue_modal_opened', {
    organization,
    ...getAnalyticsDataForGroup(group),
    external_issue_provider: sentryAppComponent.sentryApp.slug,
    external_issue_type: 'sentry_app',
  });
  recordInteraction(
    sentryAppComponent.sentryApp.slug,
    'sentry_app_component_interacted',
    {
      componentType: 'issue-link',
    }
  );

  openModal(
    deps => (
      <SentryAppExternalIssueModal
        {...deps}
        {...{group, event, sentryAppComponent, sentryAppInstallation}}
      />
    ),
    {closeEvents: 'escape-key'}
  );
};

type Props = ModalRenderProps & {
  event: Event;
  group: Group;
  sentryAppComponent: SentryAppComponent;
  sentryAppInstallation: SentryAppInstallation;
};

function SentryAppExternalIssueModal(props: Props) {
  const [action, setAction] = useState<'create' | 'link'>('create');
  const {
    Header,
    Body,
    sentryAppComponent,
    sentryAppInstallation,
    group,
    closeModal,
    event,
  } = props;

  const name = sentryAppComponent.sentryApp.name;
  // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
  const config = sentryAppComponent.schema[action];

  return (
    <Fragment>
      <Header closeButton>{tct('[name] Issue', {name})}</Header>
      <TabsContainer>
        <Tabs value={action} onChange={setAction}>
          <TabList>
            <TabList.Item key="create">{t('Create')}</TabList.Item>
            <TabList.Item key="link">{t('Link')}</TabList.Item>
          </TabList>
        </Tabs>
      </TabsContainer>
      <Body>
        <SentryAppExternalIssueForm
          group={group}
          sentryAppInstallation={sentryAppInstallation}
          appName={name}
          config={config}
          action={action}
          onSubmitSuccess={closeModal}
          event={event}
        />
      </Body>
    </Fragment>
  );
}

const TabsContainer = styled('div')`
  margin-bottom: ${space(2)};
`;
