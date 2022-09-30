import Alert from 'sentry/components/alert';
import Button from 'sentry/components/button';
import {t} from 'sentry/locale';
import {Organization, Project} from 'sentry/types';

type Props = {
  organization: Organization;
  /**
   * The project that the user is currently viewing.
   * If there are more projects selected, this shall be undefined.
   */
  selectProject?: Project;
};

export function DynamicSamplingAlert({organization, selectProject}: Props) {
  const showAlert =
    organization.features.includes('server-side-sampling') &&
    organization.features.includes('server-side-sampling-ui') &&
    selectProject !== undefined;

  if (!showAlert) {
    return null;
  }

  return (
    <Alert
      type="warning"
      showIcon
      trailingItems={
        <Button
          priority="link"
          borderless
          href={`/settings/${organization.slug}/projects/${selectProject.slug}/server-side-sampling/set-global-sample-rate/?referrer=performance.rate-alert`}
        >
          {t('Adjust Sample Rates')}
        </Button>
      }
    >
      {t(
        'The accuracy of performance metrics can be improved by adjusting your client-side sample rate.'
      )}
    </Alert>
  );
}
