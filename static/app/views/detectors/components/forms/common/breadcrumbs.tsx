import {Fragment, useContext} from 'react';

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

function EditableDetectorName() {
  const {form} = useContext(FormContext);
  const value = useFormField<string>('name');
  const {setHasSetDetectorName} = useDetectorFormContext();

  return (
    <BreadcrumbList.Title
      item={{
        type: 'editable-title',
        allowEmpty: true,
        value: value || '',
        onChange: newValue => {
          setHasSetDetectorName(true);
          form?.setValue('name', newValue);
        },
        placeholder: t('New Monitor'),
        'aria-label': t('Monitor Name'),
      }}
    />
  );
}

export function DetectorFormBreadcrumbs() {
  const organization = useOrganization();
  const {detectorType} = useDetectorFormContext();

  return (
    <Fragment>
      <TopBar.Slot name="breadcrumbs">
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

      <TopBar.Slot name="title">
        <EditableDetectorName />
      </TopBar.Slot>
    </Fragment>
  );
}
