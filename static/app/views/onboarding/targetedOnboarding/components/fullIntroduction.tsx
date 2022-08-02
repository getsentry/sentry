import {Fragment} from 'react';

import {PlatformKey} from 'sentry/data/platformCategories';
import platforms from 'sentry/data/platforms';
import {t} from 'sentry/locale';
import {Organization} from 'sentry/types';

import SetupIntroduction from './setupIntroduction';

type Props = {
  currentPlatform: PlatformKey;
  organization: Organization;
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
    </Fragment>
  );
}
