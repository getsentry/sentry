import {Fragment} from 'react';
import {z} from 'zod';

import {AutoSaveForm} from '@sentry/scraps/form';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {Panel} from 'sentry/components/panels/panel';
import {PanelAlert} from 'sentry/components/panels/panelAlert';
import {PanelBody} from 'sentry/components/panels/panelBody';
import {PanelHeader} from 'sentry/components/panels/panelHeader';
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
    <Panel>
      <PanelHeader>{t('Support Access')}</PanelHeader>
      <PanelBody>
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
            <Fragment>
              <PanelAlert variant="info">
                {field.state.value
                  ? t('Sentry employees have access to your organization')
                  : t('Sentry employees do not have access to your organization')}
              </PanelAlert>
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
            </Fragment>
          )}
        </AutoSaveForm>
      </PanelBody>
    </Panel>
  );
}
