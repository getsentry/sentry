import styled from '@emotion/styled';

import Button from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {Panel} from 'sentry/components/panels';
import {IconFlag} from 'sentry/icons/iconFlag';
import {t} from 'sentry/locale';
import {FeatureFlags} from 'sentry/types/featureFlags';
import EmptyMessage from 'sentry/views/settings/components/emptyMessage';

import {AddFlagButton} from './addFlagButton';

type Props = {
  flags: FeatureFlags;
  hasAccess: boolean;
  onGetStarted: (key: string | undefined) => void;
};

export function Promo({onGetStarted, hasAccess, flags}: Props) {
  return (
    <Panel>
      <EmptyMessage
        icon={<IconFlag size="xl" />}
        size="large"
        title={t('Get started with feature flags')}
        description={t(
          'Feature flags allow you to configure your code into different flavors by dynamically toggling certain functionality.'
        )}
        action={
          <ButtonList gap={1}>
            <AddFlagButton
              disabled={!hasAccess}
              onAddFlag={onGetStarted}
              flags={flags}
              size="md"
            />
            <Button href="" external>
              {t('Read Docs')}
            </Button>
          </ButtonList>
        }
      />
    </Panel>
  );
}

const ButtonList = styled(ButtonBar)`
  grid-template-columns: repeat(auto-fit, minmax(130px, max-content));
`;
