import {useQueryClient} from '@tanstack/react-query';

import {AutoSaveForm, FieldGroup} from '@sentry/scraps/form';

import Feature from 'sentry/components/acl/feature';
import {t} from 'sentry/locale';
import {fetchMutation} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';

import {
  generalSettingsSchema,
  getGeneralSettingsQueryOptions,
  type GeneralSettings,
} from './detectorSettings';

export function GeneralSettingsSection({
  general,
  hasWriteAccess,
}: {
  general: GeneralSettings | undefined;
  hasWriteAccess: boolean;
}) {
  const organization = useOrganization();
  const {projectId: projectSlug} = useParams<{projectId: string}>();
  const queryClient = useQueryClient();
  const endpoint = `/projects/${organization.slug}/${projectSlug}/performance/configure/`;

  return (
    <Feature features="organizations:insight-modules">
      <FieldGroup title={t('General')}>
        <AutoSaveForm
          name="enable_images"
          schema={generalSettingsSchema}
          initialValue={Boolean(general?.enable_images)}
          mutationOptions={{
            mutationFn: (data: {enable_images: boolean}) =>
              fetchMutation({url: endpoint, method: 'POST', data}),
            onSuccess: (_data, variables) => {
              queryClient.setQueryData(
                getGeneralSettingsQueryOptions(organization.slug, projectSlug).queryKey,
                previous =>
                  previous
                    ? {
                        json: {...previous.json, enable_images: variables.enable_images},
                        headers: previous.headers,
                      }
                    : previous
              );
            },
          }}
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
