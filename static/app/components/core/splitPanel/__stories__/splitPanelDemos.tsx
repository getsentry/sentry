import {useState} from 'react';

import {Button} from '@sentry/scraps/button';
import {Container, Stack} from '@sentry/scraps/layout';
import {SplitPanel} from '@sentry/scraps/splitPanel';
import {Text} from '@sentry/scraps/text';

import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';

export function PersistedSizeDemo() {
  const [size, setSize] = useLocalStorageState('scraps-splitpanel-size', 220);

  return (
    <Stack width="100%" gap="sm">
      <Text variant="muted">Sized pane width: {size}px</Text>
      <Container
        width="100%"
        height="240px"
        border="primary"
        radius="md"
        overflow="hidden"
      >
        <SplitPanel
          defaultSize={220}
          initialSize={size}
          minSize={120}
          fillMinSize={240}
          onResizeEnd={({endSize}) => setSize(endSize)}
          sized={
            <Stack padding="md" background="primary" height="100%">
              <Text bold>Sized pane</Text>
            </Stack>
          }
          fill={
            <Stack padding="md" background="primary" height="100%">
              <Text bold>Fill pane</Text>
            </Stack>
          }
        />
      </Container>
    </Stack>
  );
}

export function SinglePaneDemo() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <Stack width="100%" gap="sm" align="end">
      <Container
        width="100%"
        height="240px"
        border="primary"
        radius="md"
        overflow="hidden"
      >
        <SplitPanel
          defaultSize={220}
          minSize={120}
          fillMinSize={240}
          sized={
            <Stack padding="md" background="primary" height="100%">
              <Text bold>Sized pane</Text>
            </Stack>
          }
          fill={
            collapsed ? undefined : (
              <Stack padding="md" background="primary" height="100%">
                <Text bold>Fill pane</Text>
              </Stack>
            )
          }
        />
      </Container>
      <Button variant="primary" size="xs" onClick={() => setCollapsed(c => !c)}>
        {collapsed ? 'Show fill pane' : 'Hide fill pane'}
      </Button>
    </Stack>
  );
}
