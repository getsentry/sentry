import {Breadcrumbs} from 'sentry/components/breadcrumbs';
import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';
import {EditableDetectorName} from 'sentry/views/detectors/components/forms/common/editableDetectorName';
import {makeMonitorBasePathname} from 'sentry/views/detectors/pathnames';

export function DetectorFormBreadcrumbs() {
  const organization = useOrganization();
  return (
    <Breadcrumbs
      crumbs={[
        {
          label: t('Monitors'),
          to: makeMonitorBasePathname(organization.slug),
        },
        {label: <EditableDetectorName />},
      ]}
    />
  );
}
