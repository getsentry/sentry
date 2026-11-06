import {useStore} from 'zustand';

import {Alert} from '@sentry/scraps/alert';
import {Stack} from '@sentry/scraps/layout';

import {t} from 'sentry/locale';
import {ConfigStore} from 'sentry/stores/configStore';

import {RelocationOnboarding} from './relocation';

export default function RelocationOnboardingContainer() {
  const features = useStore(ConfigStore, state => state.features);

  if (!features.has('relocation:enabled')) {
    return (
      <Stack flex={1} padding="2xl 3xl">
        <Alert.Container>
          <Alert variant="warning" showIcon={false}>
            {t("You don't have access to this feature")}
          </Alert>
        </Alert.Container>
      </Stack>
    );
  }

  return <RelocationOnboarding />;
}
