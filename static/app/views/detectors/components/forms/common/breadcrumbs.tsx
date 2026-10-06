import {useContext} from 'react';
import {observer} from 'mobx-react-lite';

import {BreadcrumbList} from '@sentry/scraps/breadcrumbList';

import {FormContext} from 'sentry/components/forms/formContext';
import {useFormField} from 'sentry/components/workflowEngine/form/useFormField';
import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useDetectorFormContext} from 'sentry/views/detectors/components/forms/context';
import {
  makeMonitorBasePathname,
  makeMonitorTypePathname,
} from 'sentry/views/detectors/pathnames';
import {getDetectorTypeLabel} from 'sentry/views/detectors/utils/detectorTypeConfig';
import {TopBar} from 'sentry/views/navigation/topBar';

export const DetectorFormBreadcrumbs = observer(function DetectorFormBreadcrumbs() {
  const organization = useOrganization();
  const {form} = useContext(FormContext);
  const value = useFormField<string>('name');
  const {detectorType, setHasSetDetectorName} = useDetectorFormContext();
  return (
    <TopBar.Slot
      name="breadcrumbs"
      title={{
        type: 'editable-title',
        allowEmpty: true,
        error: form?.getError('name'),
        value: value || '',
        onChange: newValue => {
          form?.setValue('name', newValue);
          setHasSetDetectorName(true);
        },
        placeholder: t('New Monitor'),
        'aria-label': t('Monitor Name'),
      }}
    >
      <BreadcrumbList
        items={[
          {
            type: 'link',
            label: t('Monitors'),
            to: makeMonitorBasePathname(organization.slug),
          },
          {
            type: 'link',
            label: getDetectorTypeLabel(detectorType),
            to: makeMonitorTypePathname(organization.slug, detectorType),
          },
        ]}
      />
    </TopBar.Slot>
  );
});
