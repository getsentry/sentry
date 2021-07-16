import * as React from 'react';
import {motion} from 'framer-motion';

import {openInviteMembersModal} from 'app/actionCreators/modal';
import Button from 'app/components/button';
import {PlatformKey} from 'app/data/platformCategories';
import platforms from 'app/data/platforms';
import {t, tct} from 'app/locale';

import SetupIntroduction from './setupIntroduction';

type Props = {
  currentPlatform: PlatformKey;
};

export default function FullIntroduction({currentPlatform}: Props) {
  return (
    <React.Fragment>
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
              />
            ),
          }
        )}
      </motion.p>
    </React.Fragment>
  );
}
