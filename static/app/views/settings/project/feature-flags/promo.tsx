import styled from '@emotion/styled';

import Button from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {Panel} from 'sentry/components/panels';
import {IconFlag} from 'sentry/icons/iconFlag';
import {t} from 'sentry/locale';
import EmptyMessage from 'sentry/views/settings/components/emptyMessage';

type Props = {
  hasAccess: boolean;
  onGetStarted: () => void;
};

export function Promo({onGetStarted, hasAccess}: Props) {
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
            <Button
              priority="primary"
              onClick={onGetStarted}
              disabled={!hasAccess}
              title={
                hasAccess
                  ? undefined
                  : t('You do not have permission to add feature flags')
              }
            >
              {t('Add Feature Flag')}
            </Button>
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
