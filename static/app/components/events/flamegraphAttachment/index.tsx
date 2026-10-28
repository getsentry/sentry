import {useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Select} from '@sentry/scraps/select';
import {Text} from '@sentry/scraps/text';

import {FlamegraphPreview} from 'sentry/components/profiling/flamegraph/flamegraphPreview';
import {t, tn} from 'sentry/locale';
import {colorComponentsToRGBA} from 'sentry/utils/profiling/colors/utils';
import {FlamegraphThemeProvider} from 'sentry/utils/profiling/flamegraph/flamegraphThemeProvider';
import {useFlamegraphTheme} from 'sentry/utils/profiling/flamegraph/useFlamegraphTheme';

import {
  createFlamegraph,
  type FlamegraphAttachmentData,
  type FlamegraphAttachmentTree,
} from './utils';

function getTreeLabel(tree: FlamegraphAttachmentTree, index: number): string {
  const name =
    tree.thread_id === undefined
      ? t('Tree %s', index + 1)
      : t('Tree %s · Thread %s', index + 1, tree.thread_id);
  return tree.thread_attributed ? t('%s · Responsible thread', name) : name;
}

export function FlamegraphAttachment({data}: {data: FlamegraphAttachmentData}) {
  const [selectedTree, setSelectedTree] = useState(0);
  const flamegraph = useMemo(
    () => createFlamegraph(data, selectedTree),
    [data, selectedTree]
  );
  const treeLabel = getTreeLabel(data.trees[selectedTree]!, selectedTree);

  return (
    <FlamegraphThemeProvider>
      <Stack gap="md">
        <Flex align="center" gap="md" wrap="wrap" justify="between">
          {data.trees.length > 1 && (
            <Container minWidth="240px">
              <Select
                aria-label={t('Call tree')}
                value={selectedTree}
                options={data.trees.map((tree, index) => ({
                  value: index,
                  label: getTreeLabel(tree, index),
                }))}
                onChange={option => setSelectedTree(option.value)}
                isClearable={false}
              />
            </Container>
          )}
          <Text variant="muted" size="sm">
            {tn('%s sample', '%s samples', flamegraph.configSpace.width)}
          </Text>
        </Flex>
        <FlamegraphLegend />
        <Container
          height="300px"
          position="relative"
          role="img"
          aria-label={t('Flamegraph for %s', treeLabel)}
        >
          <FlamegraphPreview
            key={selectedTree}
            flamegraph={flamegraph}
            relativeStartTimestamp={0}
            relativeStopTimestamp={flamegraph.configSpace.width}
            anchorAtRoot
          />
        </Container>
      </Stack>
    </FlamegraphThemeProvider>
  );
}

function FlamegraphLegend() {
  const theme = useFlamegraphTheme();
  return (
    <Flex gap="lg" wrap="wrap">
      <Flex align="center" gap="xs">
        <LegendMarker
          width="12px"
          height="12px"
          radius="xs"
          color={colorComponentsToRGBA(theme.COLORS.FRAME_APPLICATION_COLOR)}
        />
        <Text size="sm" variant="muted">
          {t('Application Function')}
        </Text>
      </Flex>
      <Flex align="center" gap="xs">
        <LegendMarker
          width="12px"
          height="12px"
          radius="xs"
          color={colorComponentsToRGBA(theme.COLORS.FRAME_SYSTEM_COLOR)}
        />
        <Text size="sm" variant="muted">
          {t('System Function')}
        </Text>
      </Flex>
    </Flex>
  );
}

const LegendMarker = styled(Container)<{color: string}>`
  background-color: ${p => p.color};
`;
