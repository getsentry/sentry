import {t, tct} from 'sentry/locale';
import type {ActionHandler} from 'sentry/types/workflowEngine/actions';
import {useActionNodeContext} from 'sentry/views/automations/components/actionNodes';
import {SentryAppActionSettingsButton} from 'sentry/views/automations/components/actions/sentryAppSettingsButton';

export function SentryAppDetails({handler}: {handler: ActionHandler}) {
  const name = handler?.sentryApp?.name;
  const title = handler?.sentryApp?.title;

  return title || name || t('Unknown SentryApp action');
}

export function SentryAppNode() {
  const {handler} = useActionNodeContext();
  const name = handler?.sentryApp?.name;
  const title = handler?.sentryApp?.title;
  return tct('[label] with these [settings]', {
    label: title || name || t('Unknown SentryApp'),
    settings: <SentryAppActionSettingsButton />,
  });
}
