import {GettingStartedDoc} from 'sentry/components/onboarding/gettingStartedDoc';
import {t} from 'sentry/locale';

export default function GettingStartedWithReact() {
  const nextSteps = [
    {
      name: t('Source Maps'),
      description: t('Learn how to enable readable stack traces in your Sentry errors.'),
      link: 'https://docs.sentry.io/platforms/javascript/guides/react/sourcemaps/',
    },
    {
      name: t('React Features'),
      description: t('Learn about our first class integration with the React framework.'),
      link: 'https://docs.sentry.io/platforms/javascript/guides/react/features/',
    },
  ];

  return <GettingStartedDoc nextSteps={nextSteps} />;
}
