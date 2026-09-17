import {AutoSaveForm, FieldGroup} from '@sentry/scraps/form';

import Feature from 'sentry/components/acl/feature';
import {t} from 'sentry/locale';

import {generalSettingsSchema, type GeneralSettings} from './projectPerformanceSettings';
import {useGeneralSettingsMutationOptions} from './useGeneralSettingsMutationOptions';

type GeneralSettingsSectionProps = {
  general: GeneralSettings | undefined;
  hasWriteAccess: boolean;
};

export function GeneralSettingsSection({
  general,
  hasWriteAccess,
}: GeneralSettingsSectionProps) {
  const mutationOptions = useGeneralSettingsMutationOptions();

  return (
    <Feature features="organizations:insight-modules">
      <FieldGroup title={t('General')}>
        <AutoSaveForm
          name="enable_images"
          schema={generalSettingsSchema}
          initialValue={Boolean(general?.enable_images)}
          mutationOptions={mutationOptions}
        >
          {field => (
            <field.Layout.Row
              label={t('Images')}
              hintText={t('Enables images from real data to be displayed')}
            >
              <field.Switch
                checked={field.state.value}
                onChange={field.handleChange}
                disabled={!hasWriteAccess}
              />
            </field.Layout.Row>
          )}
        </AutoSaveForm>
      </FieldGroup>
    </Feature>
  );
}
