import {Container, Stack} from '@sentry/scraps/layout';
import {IndeterminateLoader} from '@sentry/scraps/loader';
import {Heading, Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';
import type {Block} from 'sentry/views/seerExplorer/types';

import {DashboardChatBlock} from './dashboardChatBlock';

interface CreateFromSeerLoadingProps {
  blocks: Block[];
  seerRunId: number;
}

export function CreateFromSeerLoading({blocks, seerRunId}: CreateFromSeerLoadingProps) {
  const blocksToRender = blocks.slice(-3);
  return (
    <Stack flex={1} padding="2xl 3xl">
      <Stack gap="lg" align="center" justify="center" flex="1">
        <Stack gap="sm" width="640px">
          <Container paddingBottom="lg">
            <IndeterminateLoader />
          </Container>
          <Heading as="h3">{t('Generating Dashboard')}</Heading>
          <Text variant="muted">
            {t('Stay on this page while we get this made for you')}
          </Text>
          <Container overflow="hidden" maxHeight="500px" paddingTop="lg">
            <Stack
              border={blocks.length > 0 ? 'primary' : undefined}
              radius="md"
              background="primary"
            >
              {blocksToRender.map((block, index) => (
                <DashboardChatBlock
                  key={block.id}
                  block={block}
                  blockIndex={index}
                  runId={seerRunId}
                />
              ))}
            </Stack>
          </Container>
        </Stack>
      </Stack>
    </Stack>
  );
}
