import {mutationOptions} from '@tanstack/react-query';
import {z} from 'zod';

import {Alert} from '@sentry/scraps/alert';
import {AutoSaveField, FieldGroup} from '@sentry/scraps/form';

import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import {updateOrganization} from 'sentry/actionCreators/organizations';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {fetchMutation} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

const dataSecrecySchema = z.object({
  allowSuperuserAccess: z.boolean(),
});

export default function DataSecrecy() {
  const organization = useOrganization();
  const disabled = !organization.access.includes('org:write');

  const dataSecrecyMutationOptions = mutationOptions({
    mutationFn: (data: {allowSuperuserAccess: boolean}) => {
      return fetchMutation<Organization>({
        method: 'PUT',
        url: `/organizations/${organization.slug}/`,
        data,
      });
    },
    onSuccess: (data, variables) => {
      updateOrganization(data);
      addSuccessMessage(
        variables.allowSuperuserAccess
          ? t('Successfully allowed support access.')
          : t('Successfully removed support access.')
      );
    },
  });

  return (
    <FieldGroup title={t('Support Access')}>
      <Alert variant="info">
        {organization.allowSuperuserAccess
          ? t('Sentry employees have access to your organization')
          : t('Sentry employees do not have access to your organization')}
      </Alert>

      <AutoSaveField
        name="allowSuperuserAccess"
        schema={dataSecrecySchema}
        initialValue={organization.allowSuperuserAccess}
        mutationOptions={dataSecrecyMutationOptions}
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
              disabled={disabled}
            />
          </field.Layout.Row>
        )}
      </AutoSaveField>
    </FieldGroup>
  );
}
