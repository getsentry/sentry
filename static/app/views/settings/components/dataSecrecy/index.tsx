import {useState} from 'react';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import BooleanField, {
  type BooleanFieldProps,
} from 'sentry/components/forms/fields/booleanField';
import Panel from 'sentry/components/panels/panel';
import PanelAlert from 'sentry/components/panels/panelAlert';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import {t} from 'sentry/locale';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';

export default function DataSecrecy() {
  const api = useApi();
  const organization = useOrganization();

  // state for the allowSuperuserAccess bit field
  const [allowAccess, setAllowAccess] = useState(organization.allowSuperuserAccess);

  const updateAllowedAccess = async (value: boolean) => {
    try {
      await api.requestPromise(`/organizations/${organization.slug}/`, {
        method: 'PUT',
        data: {allowSuperuserAccess: value},
      });
      setAllowAccess(value);
      addSuccessMessage(
        value
          ? t('Successfully allowed support access.')
          : t('Successfully removed support access.')
      );
    } catch (error) {
      addErrorMessage(t('Unable to save changes.'));
    }
  };

  const allowAccessProps: BooleanFieldProps = {
    name: 'allowSuperuserAccess',
    label: t('Allow access to Sentry employees'),
    help: t(
      'Sentry employees will not have access to your organization unless granted permission'
    ),
    'aria-label': t(
      'Sentry employees will not have access to your data unless granted permission'
    ),
    value: allowAccess,
    disabled: !organization.access.includes('org:write'),
    onBlur: updateAllowedAccess,
  };

  return (
    <Panel>
      <PanelHeader>{t('Support Access')}</PanelHeader>
      <PanelBody>
        <PanelAlert variant="info">
          {allowAccess
            ? t('Sentry employees have access to your organization')
            : t('Sentry employees do not have access to your organization')}
        </PanelAlert>

        <BooleanField {...allowAccessProps} />
      </PanelBody>
    </Panel>
  );
}
