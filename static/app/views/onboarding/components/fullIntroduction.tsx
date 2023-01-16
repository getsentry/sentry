import {PlatformKey} from 'sentry/data/platformCategories';
import platforms from 'sentry/data/platforms';
import {t} from 'sentry/locale';

import SetupIntroduction from './setupIntroduction';

type Props = {
  currentPlatform: PlatformKey;
};

export default function FullIntroduction({currentPlatform}: Props) {
  return (
    <SetupIntroduction
      stepHeaderText={t(
        'Prepare the %s SDK',
        platforms.find(p => p.id === currentPlatform)?.name ?? ''
      )}
      platform={currentPlatform}
    />
  );
}
