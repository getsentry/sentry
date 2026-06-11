import {css} from '@emotion/react';

import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {PrideSentryLogo} from 'sentry/components/prideSplash';
import {t} from 'sentry/locale';

type Props = ModalRenderProps;

export default function PrideSplashModal({Body}: Props) {
  return (
    <Body>
      <Flex direction="column" align="center" gap="xl" padding="xl">
        <PrideSentryLogo size={200} />
        <Flex direction="column" align="center" gap="xs">
          <Text size="lg" bold>
            {t('You’re valid. Your code, however…')}
          </Text>
          <Text variant="muted" size="sm">
            {t('Happy Pride from Sentry ❤️')}
          </Text>
        </Flex>
      </Flex>
    </Body>
  );
}

export const modalCss = css`
  width: 100%;
  max-width: 440px;
`;
