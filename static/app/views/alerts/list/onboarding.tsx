import emptyStateImg from 'sentry-images/spot/alerts-empty-state.svg';

import {Image} from '@sentry/scraps/image';

import {OnboardingPanel} from 'sentry/components/onboardingPanel';
import {t} from 'sentry/locale';

type Props = {
  actions: React.ReactNode;
};

export function Onboarding({actions}: Props) {
  return (
    <OnboardingPanel
      illustration={
        <Image
          height={{zero: '150px', '2xl': 'auto'}}
          src={emptyStateImg}
          alt={t('Illustration of a robot surrounded by warning signs')}
        />
      }
      title={t('More signal, less noise')}
      description={t(
        'Not every error is worth an email. Set your own rules for alerts you need, with information that helps.'
      )}
      action={actions}
    />
  );
}
