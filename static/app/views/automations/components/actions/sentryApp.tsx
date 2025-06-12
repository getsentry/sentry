import {openModal} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/core/button';
import {IconSettings} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import type {ActionHandler} from 'sentry/types/workflowEngine/actions';
import SentryAppRuleModal from 'sentry/views/alerts/rules/issue/sentryAppRuleModal';
import {useActionNodeContext} from 'sentry/views/automations/components/actionNodes';
import type {SchemaFormConfig} from 'sentry/views/settings/organizationIntegrations/sentryAppExternalForm';

export function SentryAppDetails({handler}: {handler: ActionHandler}) {
  const name = handler?.sentryApp?.name;
  const title = handler?.sentryApp?.title;

  return title || name || t('Unknown SentryApp action');
}

export function SentryAppNode() {
  const {handler} = useActionNodeContext();
  const sentryApp = handler?.sentryApp;
  if (!sentryApp) {
    return t('Unknown SentryApp action');
  }

  const name = sentryApp.name;
  const title = sentryApp.title;
  return tct('[label] [settings]', {
    label: title || name,
    settings: sentryApp.settings
      ? tct('with these [settings]', {settings: <SentryAppActionSettingsButton />})
      : null,
  });
}

function SentryAppActionSettingsButton() {
  const {action, handler, onUpdate} = useActionNodeContext();
  const sentryApp = handler.sentryApp;

  if (!sentryApp?.settings) {
    return null;
  }

  return (
    <Button
      size="sm"
      icon={<IconSettings />}
      onClick={() => {
        openModal(
          deps => (
            <SentryAppRuleModal
              {...deps}
              sentryAppInstallationUuid={sentryApp.installationUuid}
              config={sentryApp.settings as SchemaFormConfig}
              appName={sentryApp.title ?? sentryApp.name}
              onSubmitSuccess={(formData: Record<string, string>) =>
                onUpdate({data: formData})
              }
              resetValues={action.data}
            />
          ),
          {closeEvents: 'escape-key'}
        );
      }}
    >
      {t('Action Settings')}
    </Button>
  );
}
