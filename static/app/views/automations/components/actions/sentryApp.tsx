import {tct} from 'sentry/locale';
import {useActionNodeContext} from 'sentry/views/automations/components/actionNodes';
import {SentryAppActionSettingsButton} from 'sentry/views/automations/components/actions/sentryAppSettingsButton';

export function SentryAppNode() {
  const {handler} = useActionNodeContext();
  const name = handler?.sentryApp?.name;
  const title = handler?.sentryApp?.title;
  return tct('[label] with these [settings]', {
    label: title || name,
    settings: <SentryAppActionSettingsButton />,
  });
}
