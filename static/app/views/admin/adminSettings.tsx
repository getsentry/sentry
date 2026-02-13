import Feature from 'sentry/components/acl/feature';
import Form from 'sentry/components/forms/form';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Panel from 'sentry/components/panels/panel';
import PanelHeader from 'sentry/components/panels/panelHeader';
import {t} from 'sentry/locale';
import getApiUrl from 'sentry/utils/api/getApiUrl';
import {useApiQuery} from 'sentry/utils/queryClient';

import {getOption, getOptionField} from './options';

const optionsAvailable = [
  'system.url-prefix',
  'system.admin-email',
  'system.support-email',
  'system.security-email',
  'auth.allow-registration',
  'auth.ip-rate-limit',
  'auth.user-rate-limit',
  'api.rate-limit.org-create',
  'beacon.anonymous',
];

type Field = ReturnType<typeof getOption>;

type FieldDef = {
  field: Field;
  value: string | undefined;
};

export default function AdminSettings() {
  const {data, isPending, isError} = useApiQuery<Record<string, FieldDef>>(
    [getApiUrl('/internal/options/')],
    {
      staleTime: 0,
    }
  );

  if (isError) {
    return <LoadingError />;
  }

  if (isPending) {
    return <LoadingIndicator />;
  }

  const initialData: Record<string, React.ReactNode> = {};
  const fields: Record<string, React.ReactNode> = {};
  for (const key of optionsAvailable) {
    const option = data[key] ?? ({field: {}, value: undefined} as FieldDef);

    if (option.value === undefined || option.value === '') {
      const defn = getOption(key);
      initialData[key] = defn.defaultValue ? defn.defaultValue() : '';
    } else {
      initialData[key] = option.value;
    }
    fields[key] = getOptionField(key, option.field);
  }

  return (
    <div>
      <h3>{t('Settings')}</h3>

      <Form
        apiMethod="PUT"
        apiEndpoint="/internal/options/"
        initialData={initialData}
        saveOnBlur
      >
        <Panel>
          <PanelHeader>{t('General')}</PanelHeader>
          {fields['system.url-prefix']}
          {fields['system.admin-email']}
          {fields['system.support-email']}
          {fields['system.security-email']}
        </Panel>

        <Panel>
          <PanelHeader>{t('Security & Abuse')}</PanelHeader>
          {fields['auth.allow-registration']}
          {fields['auth.ip-rate-limit']}
          {fields['auth.user-rate-limit']}
          {fields['api.rate-limit.org-create']}
        </Panel>

        <Panel>
          <PanelHeader>{t('Beacon')}</PanelHeader>
          {fields['beacon.anonymous']}
        </Panel>
        <Feature features="organizations:view-hierarchies-options-dev">
          <Panel>
            <PanelHeader>{t('View Hierarchy')}</PanelHeader>
          </Panel>
        </Feature>
      </Form>
    </div>
  );
}
