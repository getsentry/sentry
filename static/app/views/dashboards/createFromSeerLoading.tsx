import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';
import {BlockComponent} from 'sentry/views/seerExplorer/blockComponents';
import type {Block} from 'sentry/views/seerExplorer/types';

interface CreateFromSeerLoadingProps {
  blocks: Block[];
  seerRunId: number;
}

export function CreateFromSeerLoading({blocks, seerRunId}: CreateFromSeerLoadingProps) {
  const blocksToRender = blocks.slice(-3);
  return (
      <Flex direction="column" gap="lg" align="center" justify="center" flex="1">
        <Flex direction="column" gap="sm" width="640px">
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
                <BlockComponent
                  key={block.id}
                  block={block}
                  blockIndex={index}
                  runId={seerRunId}
                  isLast={index === blocksToRender.length - 1}
                />
              ))}
            </Stack>
          </Container>
        </Flex>
      </Flex>
  );
}
