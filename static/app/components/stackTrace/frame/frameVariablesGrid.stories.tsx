import {Container, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {FrameVariablesGrid} from 'sentry/components/stackTrace/frame/frameVariablesGrid';
import {
  NativeFrameVariables,
  type NativeFrameVariable,
} from 'sentry/components/stackTrace/frame/nativeFrameVariables';
import * as Storybook from 'sentry/stories';

const position = [
  {name: 'x', type: 'float', kind: 'number', value: '1.5'},
  {name: 'y', type: 'float', kind: 'number', value: '-3.2'},
  {name: 'z', type: 'float', kind: 'number', value: '0.0'},
] satisfies NativeFrameVariable[];

// Synthetic, decoded presentation fixtures. These are not the current API format.
const nativeVariables: NativeFrameVariable[] = [
  {
    name: 'player',
    type: 'Player *',
    kind: 'object',
    children: [
      {name: 'id', type: 'int', kind: 'number', value: '1'},
      {name: 'name', type: 'char[64]', kind: 'string', value: 'Alice'},
      {
        name: 'status',
        type: 'RequestStatus',
        kind: 'enum',
        value: 'STATUS_OK',
      },
      {name: 'position', type: 'Vec3', kind: 'object', children: position},
      {name: 'health', type: 'float', kind: 'number', value: '-5.5'},
      {
        name: 'inventory',
        type: 'Inventory *',
        kind: 'object',
        children: [
          {name: 'capacity', type: 'int', kind: 'number', value: '16'},
          {name: 'count', type: 'int', kind: 'number', value: '2'},
          {
            name: 'items',
            type: 'int[2]',
            kind: 'object',
            children: [
              {name: '[0]', type: 'int', kind: 'number', value: '42'},
              {name: '[1]', type: 'int', kind: 'number', value: '7'},
            ],
          },
        ],
      },
    ],
  },
  {name: 'frame_number', type: 'int', kind: 'number', value: '1'},
  {name: 'local_counter', type: 'int', kind: 'number', value: '10'},
  {
    name: 'm_attachmentDescriptorPoolAllocator',
    type: 'vk::DescriptorPoolAllocator *',
    kind: 'object',
    children: [
      {name: 'capacity', type: 'uint32_t', kind: 'number', value: '128'},
      {name: 'allocated', type: 'uint32_t', kind: 'number', value: '12'},
    ],
  },
  {
    name: 'deferredLightingResolveFullscreenPass',
    type: 'vk::RenderPass',
    kind: 'object',
    children: [
      {
        name: 'handle',
        type: 'VkRenderPass',
        kind: 'pointer',
        value: '0x102a4c1e0',
      },
    ],
  },
  {name: 'damage', type: 'float', kind: 'number', value: '25.5'},
  {name: 'velocity', type: 'Vec3', kind: 'object', children: position},
  {name: 'pos_ptr', type: 'Vec3 *', kind: 'object', children: position},
  {name: 'health_ptr', type: 'float *', kind: 'number', value: '-5.5'},
  {name: 'status_ptr', type: 'RequestStatus *', kind: 'unavailable'},
  {name: 'null_player', type: 'Player *', kind: 'null'},
];

export default Storybook.story('Frame variables', story => {
  story('Native variables — typed tree preview', () => (
    <Stack gap="lg">
      <Text>Design preview with synthetic typed values. API integration is pending.</Text>
      <Container
        border="primary"
        radius="md"
        overflow="hidden"
        maxWidth="960px"
        background="secondary"
      >
        <NativeFrameVariables variables={nativeVariables} defaultExpanded={['player']} />
      </Container>
    </Stack>
  ));

  story('Native variables — narrow', () => (
    <Container
      width="360px"
      maxWidth="100%"
      border="primary"
      radius="md"
      overflow="hidden"
    >
      <NativeFrameVariables variables={nativeVariables} defaultExpanded={['player']} />
    </Container>
  ));

  story('Native variables — empty, unavailable, and exact values', () => (
    <NativeFrameVariables
      variables={[
        {name: 'empty', type: 'Container', kind: 'object', children: []},
        {name: 'unknown', type: '<unknown>', kind: 'unavailable'},
        {name: 'zero', type: 'int', kind: 'number', value: '0'},
        {
          name: 'large_counter',
          type: 'uint64_t',
          kind: 'number',
          value: '18446744073709551615',
        },
        {
          name: 'address',
          type: 'void *',
          kind: 'pointer',
          value: '0xffffffffffffffff',
        },
        {
          name: 'message',
          type: 'char[128]',
          kind: 'string',
          value:
            'A long string with "quotes" and a newline\nfor checking wrapping in the value column.',
        },
      ]}
    />
  ));

  story('Current native wire values', () => (
    <FrameVariablesGrid
      platform="native"
      data={{
        count: '0x2a (int)',
        damage: '0x3fc00000 (float)',
        player: '0x16dc05ff0 (void*)',
        null_pointer: '0x0 (int*)',
        local_counter: 'int',
        health_ptr: 'float*',
        unknown_type: '<unknown>',
      }}
    />
  ));

  story('Existing JSON variables', () => (
    <FrameVariablesGrid
      platform="node"
      data={{
        count: 42,
        enabled: true,
        player: {name: 'Alice', position: {x: 1.5, y: -3.2, z: 0}},
        items: [1, 2, 3],
        empty: null,
        message: '0x2a (int)',
      }}
    />
  ));
});
