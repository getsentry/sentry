import styled from '@emotion/styled';

import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {ScmCardButton} from 'sentry/components/onboarding/scm/scmCardButton';
import {IconChevron, IconSliders} from 'sentry/icons';
import {t} from 'sentry/locale';
import {SETUP_CARD_MARKER_PX, SETUP_CARD_ICON_SIZE} from 'sentry/views/onboarding/consts';

interface ManualSetupCardProps {
  onSetupInBrowser: () => void;
}

export function ManualSetupCard({onSetupInBrowser}: ManualSetupCardProps) {
  return (
    <CardButton onClick={onSetupInBrowser} data-test-id="onboarding-setup-in-browser">
      <Stack border="primary" radius="xl" padding="xl" gap="0" width="100%">
        <Flex align="center" gap="md">
          <Flex width={SETUP_CARD_MARKER_PX} flexShrink={0} justify="center">
            <IconSliders size={SETUP_CARD_ICON_SIZE} variant="secondary" />
          </Flex>
          <Container flexGrow={1} minWidth="0px">
            <Text bold size="lg">
              {t('Set up manually')}
            </Text>
          </Container>
          <Flex flexShrink={0} align="center">
            <IconChevron
              direction="right"
              size={SETUP_CARD_ICON_SIZE}
              variant="secondary"
            />
          </Flex>
        </Flex>

        <Flex gap="md" paddingTop="xs">
          <Container width={SETUP_CARD_MARKER_PX} flexShrink={0} />
          <Container flexGrow={1} minWidth="0px">
            <Text variant="muted" size="md" density="comfortable" textWrap="pretty">
              {t(
                'Connect a repo, choose what to instrument and where alerts land, then follow the instructions for your project'
              )}
            </Text>
          </Container>
        </Flex>
      </Stack>
    </CardButton>
  );
}

const CardButton = styled(ScmCardButton)`
  width: 100%;
`;
