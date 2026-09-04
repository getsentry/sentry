import styled from '@emotion/styled';

import {Container, Flex, Grid} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {ScmCardButton} from 'sentry/components/onboarding/scm/scmCardButton';
import {IconSliders} from 'sentry/icons';
import {t} from 'sentry/locale';

interface ManualSetupCardProps {
  onSetupInBrowser: () => void;
}

export function ManualSetupCard({onSetupInBrowser}: ManualSetupCardProps) {
  return (
    <CardButton onClick={onSetupInBrowser} data-test-id="onboarding-setup-in-browser">
      <Grid
        columns="min-content 1fr"
        gap="md lg"
        align="center"
        border="primary"
        radius="xl"
        padding="xl"
        width="100%"
        areas={`
          "icon title"
          ".    body"
        `}
      >
        <Flex area="icon" align="center">
          <IconSliders size="sm" variant="secondary" />
        </Flex>
        <Container area="title">
          <Text bold size="lg">
            {t('Set up manually instead')}
          </Text>
        </Container>
        <Container area="body">
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
