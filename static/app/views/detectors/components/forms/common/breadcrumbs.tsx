import {Breadcrumbs} from 'sentry/components/breadcrumbs';
import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';
import {EditableDetectorName} from 'sentry/views/detectors/components/forms/common/editableDetectorName';
import {useDetectorFormContext} from 'sentry/views/detectors/components/forms/context';
import {
  makeMonitorBasePathname,
  makeMonitorTypePathname,
} from 'sentry/views/detectors/pathnames';
import {getDetectorTypeLabel} from 'sentry/views/detectors/utils/detectorTypeConfig';

export function DetectorFormBreadcrumbs() {
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
        {label: <EditableDetectorName />},
      ]}
    />
  );
}
