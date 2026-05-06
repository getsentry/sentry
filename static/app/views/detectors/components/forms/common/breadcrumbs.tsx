import type {ReactNode} from 'react';

import {withForm} from '@sentry/scraps/form';

import {Breadcrumbs} from 'sentry/components/breadcrumbs';
import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';
import {
  EditableDetectorName,
  EditableDetectorNameDeprecated,
} from 'sentry/views/detectors/components/forms/common/editableDetectorName';
import {useDetectorFormContext} from 'sentry/views/detectors/components/forms/context';
import {CRON_DEFAULT_FORM_VALUES} from 'sentry/views/detectors/components/forms/cron/fields';
import {
  makeMonitorBasePathname,
  makeMonitorTypePathname,
} from 'sentry/views/detectors/pathnames';
import {getDetectorTypeLabel} from 'sentry/views/detectors/utils/detectorTypeConfig';
import {TopBar} from 'sentry/views/navigation/topBar';

export const DetectorFormBreadcrumbs = withForm({
  defaultValues: CRON_DEFAULT_FORM_VALUES,
  props: {},
  render: ({form}) => {
    return (
      <TopBar.Slot name="title">
        <DetectorFormBreadcrumbsContent>
          <EditableDetectorName form={form} fields={{name: 'name'}} />
        </DetectorFormBreadcrumbsContent>
      </TopBar.Slot>
    );
  },
});

/**
 * Legacy version for forms using FormModel/FormContext.
 * Remove once all detector forms have migrated to the new form system.
 */
export function DetectorFormBreadcrumbsDeprecated() {
  return (
    <DetectorFormBreadcrumbsContent>
      <EditableDetectorNameDeprecated />
    </DetectorFormBreadcrumbsContent>
  );
}

function DetectorFormBreadcrumbsContent({children}: {children: NonNullable<ReactNode>}) {
  const organization = useOrganization();
  const {detectorType} = useDetectorFormContext();

  return (
    <Breadcrumbs
      crumbs={[
        {
          label: t('Monitors'),
          to: makeMonitorBasePathname(organization.slug),
        },
        {
          label: getDetectorTypeLabel(detectorType),
          to: makeMonitorTypePathname(organization.slug, detectorType),
        },
        {label: children},
      ]}
    />
  );
}
