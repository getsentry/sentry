import {t} from 'app/locale';

const onboardingSteps = {organization: 0, project: 1, configure: 2};

const stepDescriptions = {
  organization: t('Create an organization in Sentry'),
  project: t('Tell us about your project'),
  configure: t('Send an event from your application'),
};

export {onboardingSteps, stepDescriptions};
