import {Fragment} from 'react';
import {motion} from 'framer-motion';

import {openInviteMembersModal} from 'sentry/actionCreators/modal';
import Button from 'sentry/components/button';
import {PlatformKey} from 'sentry/data/platformCategories';
import platforms from 'sentry/data/platforms';
import {t, tct} from 'sentry/locale';

import SetupIntroduction from './setupIntroduction';

type Props = {
  currentPlatform: PlatformKey;
};

export default function FullIntroduction({currentPlatform}: Props) {
  return (
    <Fragment>
      <SetupIntroduction
        stepHeaderText={t(
          'Prepare the %s SDK',
          platforms.find(p => p.id === currentPlatform)?.name ?? ''
        )}
        platform={currentPlatform}
      />
      <motion.p
        variants={{
          initial: {opacity: 0},
          animate: {opacity: 1},
          exit: {opacity: 0},
        }}
      >
        {tct(
          "Don't have a relationship with your terminal? [link:Invite your team instead].",
          {
            link: (
              <Button
                priority="link"
                data-test-id="onboarding-getting-started-invite-members"
                onClick={() => {
                  openInviteMembersModal();
                }}
                aria-label={t('Invite your team instead')}
              />
            ),
          }
        )}
      </motion.p>
    </Fragment>
  );
}
