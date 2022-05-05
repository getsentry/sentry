import {Fragment} from 'react';
import {motion} from 'framer-motion';

import {PlatformKey} from 'sentry/data/platformCategories';
import platforms from 'sentry/data/platforms';
import {t} from 'sentry/locale';
import {Organization} from 'sentry/types';
import isMobile from 'sentry/utils/isMobile';

import SetupIntroduction from './setupIntroduction';

type Props = {
  currentPlatform: PlatformKey;
  organization: Organization;
};

export default function FullIntroduction({currentPlatform, organization}: Props) {
  const showMobilePrompt =
    isMobile() &&
    organization.experiments.TargetedOnboardingMobileRedirectExperiment === 'email-cta';
  return (
    <Fragment>
      <SetupIntroduction
        stepHeaderText={t(
          'Prepare the %s SDK',
          platforms.find(p => p.id === currentPlatform)?.name ?? ''
        )}
        platform={currentPlatform}
      />
      {showMobilePrompt && (
        <motion.p
          variants={{
            initial: {opacity: 0},
            animate: {opacity: 1},
            exit: {opacity: 0},
          }}
        >
          {t(
            'When you are ready, click Setup on Computer, and we will email you the installation instructions.'
          )}
        </motion.p>
      )}
    </Fragment>
  );
}
