import styled from '@emotion/styled';

import {Container, Flex, Grid} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {ScmCardButton} from 'sentry/components/onboarding/scm/scmCardButton';
import {IconChevron, IconSliders} from 'sentry/icons';
import {t} from 'sentry/locale';
import {SETUP_CARD_ICON_SIZE, SETUP_CARD_MARKER_PX} from 'sentry/views/onboarding/consts';

interface ManualSetupCardProps {
  onSetupInBrowser: () => void;
}

export function ManualSetupCard({onSetupInBrowser}: ManualSetupCardProps) {
  return (
    <CardButton onClick={onSetupInBrowser} data-test-id="onboarding-setup-in-browser">
      <Grid
        columns={`${SETUP_CARD_MARKER_PX} 1fr max-content`}
        gap="0 md"
        border="primary"
        radius="xl"
        padding="xl"
        width="100%"
        areas={`
          "icon title chevron"
          ".    body  body"
        `}
      >
        <Flex area="icon" align="center" justify="center">
          <IconSliders size={SETUP_CARD_ICON_SIZE} variant="secondary" />
        </Flex>
        <Flex area="title" align="center">
          <Text bold size="lg">
            {t('Set up manually')}
          </Text>
        </Flex>
        <Flex area="chevron" align="center">
          <IconChevron
            direction="right"
            size={SETUP_CARD_ICON_SIZE}
            variant="secondary"
          />
        </Flex>
        <Container area="body" paddingTop="xs">
          <Text variant="muted" size="md" density="comfortable" textWrap="pretty">
            {t(
              'Connect a repo, choose what to instrument and where alerts land, then follow the instructions for your project'
            )}
          </Text>
        </Container>
      </Grid>
    </CardButton>
  );
}

const CardButton = styled(ScmCardButton)`
  width: 100%;
`;
