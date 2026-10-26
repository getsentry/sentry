import {useState} from 'react';

import {DragHandle, type DragHandleVariant} from '@sentry/scraps/dragHandle';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

const MIN_SIZE = 80;
const MAX_SIZE = 360;
const DEFAULT_SIZE = 200;

const clamp = (size: number) => Math.max(MIN_SIZE, Math.min(MAX_SIZE, size));

export function DragHandleDemo({variant}: {variant?: DragHandleVariant}) {
  const [size, setSize] = useState(DEFAULT_SIZE);

  return (
    <Stack gap="sm" width="100%">
      <Text variant="muted">Sized pane width: {size}px</Text>
      <Flex height="140px" border="primary" radius="md" overflow="hidden">
        <Stack padding="md" background="secondary" flexShrink={0} flexBasis={`${size}px`}>
          <Text bold>Sized</Text>
        </Stack>
        <DragHandle
          aria-label="Resize panes"
          isSizedFirst
          max={MAX_SIZE}
          min={MIN_SIZE}
          orientation="horizontal"
          value={size}
          variant={variant}
          onDoubleClick={() => setSize(DEFAULT_SIZE)}
          onMove={delta => setSize(current => clamp(current + delta))}
        />
        <Stack padding="md" background="primary" flexGrow={1}>
          <Text bold>Fill</Text>
        </Stack>
      </Flex>
    </Stack>
  );
}
