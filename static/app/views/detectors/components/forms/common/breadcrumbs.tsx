import {Fragment} from 'react';

import {BreadcrumbList} from '@sentry/scraps/breadcrumbList';

import {FormField} from 'sentry/components/forms/formField';
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
  const {setHasSetDetectorName} = useDetectorFormContext();

  return (
    <FormField name="name" inline={false} flexibleControlStateSize stacked>
      {({onChange, value}) => (
        <BreadcrumbList.Title
          item={{
            type: 'editable-title',
            allowEmpty: true,
            value: value || '',
            onChange: newValue => {
              onChange(newValue, {
                target: {
                  value: newValue,
                },
              });
              setHasSetDetectorName(true);
            },
            placeholder: t('New Monitor'),
            'aria-label': t('Monitor Name'),
          }}
        />
      )}
    </FormField>
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
