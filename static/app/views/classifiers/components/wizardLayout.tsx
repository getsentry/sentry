import styled from '@emotion/styled';

import {Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';

const TOTAL_STEPS = 2;

export function WizardStep({children}: {children: React.ReactNode}) {
  return (
    <Stack flexGrow={1} justify="between">
      {children}
    </Stack>
  );
}

export function WizardBody({
  children,
  maxWidth,
}: {
  children: React.ReactNode;
  maxWidth: `${number}px`;
}) {
  return (
    <Flex justify="center" minWidth="0">
      <Stack gap="2xl" padding="3xl xl" width="100%" minWidth="0" maxWidth={maxWidth}>
        {children}
      </Stack>
    </Flex>
  );
}

export function WizardFooter({
  children,
  step,
}: {
  children: React.ReactNode;
  step: number;
}) {
  return (
    <FooterBar
      position="sticky"
      bottom="0"
      align="center"
      gap="lg"
      justify="end"
      padding="lg xl"
      background="primary"
      borderTop="primary"
    >
      <Text variant="muted">{t('Step %s of %s', step, TOTAL_STEPS)}</Text>
      {children}
    </FooterBar>
  );
}

const FooterBar = styled(Flex)`
  z-index: ${p => p.theme.zIndex.initial};
`;
