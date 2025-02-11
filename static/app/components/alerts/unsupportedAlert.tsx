import {Alert} from 'sentry/components/alert';
import {IconInfo} from 'sentry/icons';
import {t} from 'sentry/locale';

interface Props {
  featureName: string;
  projectSlug?: string;
}

export default function UnsupportedAlert({featureName, projectSlug}: Props) {
  return (
    <Alert data-test-id="unsupported-alert" type="info" icon={<IconInfo />}>
      {projectSlug ? (
        <strong>{t(`%s isn't available for %s.`, featureName, projectSlug)}</strong>
      ) : (
        <strong>{t(`%s isn't available for the selected projects.`, featureName)}</strong>
      )}
    </Alert>
  );
}
