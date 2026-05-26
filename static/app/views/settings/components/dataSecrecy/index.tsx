import {z} from 'zod';

import {AutoSaveForm, FieldGroup} from '@sentry/scraps/form';

import {t} from 'sentry/locale';
import {useOrganizationMutationOptions} from 'sentry/utils/organization/useOrganizationMutationOptions';
import {useOrganization} from 'sentry/utils/useOrganization';

const schema = z.object({
  allowSuperuserAccess: z.boolean(),
});

export function DataSecrecy() {
  const organization = useOrganization();
  const canEdit = organization.access.includes('org:write');
  const mutationOptions = useOrganizationMutationOptions(organization);

  return (
    <FieldGroup title={t('Support Access')}>
      <AutoSaveForm
        name="allowSuperuserAccess"
        schema={schema}
        initialValue={organization.allowSuperuserAccess}
        mutationOptions={mutationOptions}
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
