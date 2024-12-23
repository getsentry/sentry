import {Fragment, useState} from 'react';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import SentryAppExternalIssueForm from 'sentry/components/group/sentryAppExternalIssueForm';
import NavTabs from 'sentry/components/navTabs';
import {t, tct} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {SentryAppComponent, SentryAppInstallation} from 'sentry/types/integrations';

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

  const showLink = () => {
    setAction('link');
  };

  const showCreate = () => {
    setAction('create');
  };

  const onSubmitSuccess = () => {
    closeModal();
  };

  const name = sentryAppComponent.sentryApp.name;
  const config = sentryAppComponent.schema[action];

  return (
    <Fragment>
      <Header closeButton>{tct('[name] Issue', {name})}</Header>
      <NavTabs underlined>
        <li className={action === 'create' ? 'active create' : 'create'}>
          <a onClick={showCreate}>{t('Create')}</a>
        </li>
        <li className={action === 'link' ? 'active link' : 'link'}>
          <a onClick={showLink}>{t('Link')}</a>
        </li>
      </NavTabs>
      <Body>
        <SentryAppExternalIssueForm
          group={group}
          sentryAppInstallation={sentryAppInstallation}
          appName={name}
          config={config}
          action={action}
          onSubmitSuccess={onSubmitSuccess}
          event={event}
        />
      </Body>
    </Fragment>
  );
}

export default SentryAppExternalIssueModal;
