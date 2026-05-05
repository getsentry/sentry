import {z} from 'zod';

import {AutoSaveForm, FieldGroup} from '@sentry/scraps/form';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {fetchMutation} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';

const schema = z.object({
  allowSuperuserAccess: z.boolean(),
});

export function DataSecrecy() {
  const organization = useOrganization();
  const canEdit = organization.access.includes('org:write');

  return (
    <FieldGroup title={t('Support Access')}>
      <AutoSaveForm
        name="allowSuperuserAccess"
        schema={schema}
        initialValue={organization.allowSuperuserAccess}
        mutationOptions={{
          mutationFn: (data: Partial<Organization>) =>
            fetchMutation({
              url: `/organizations/${organization.slug}/`,
              method: 'PUT',
              data,
            }),
          onSuccess: (_data, variables) => {
            addSuccessMessage(
              variables.allowSuperuserAccess
                ? t('Successfully allowed support access.')
                : t('Successfully removed support access.')
            );
          },
          onError: () => {
            addErrorMessage(t('Unable to save changes.'));
          },
        }}
      >
        {field => (
          <field.Layout.Row
            label={t('Allow access to Sentry employees')}
            hintText={t(
              'Sentry employees will not have access to your organization unless granted permission'
            )}
          >
            <field.Switch
              checked={field.state.value}
              onChange={field.handleChange}
              disabled={!canEdit}
              aria-label={t(
                'Sentry employees will not have access to your data unless granted permission'
              )}
            />
          </field.Layout.Row>
        )}
      </AutoSaveForm>
    </FieldGroup>
  );
}
