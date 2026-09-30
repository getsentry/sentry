import type {ReactNode} from 'react';
import {useId, useState} from 'react';

import {Checkbox} from '@sentry/scraps/checkbox';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {FrameVariablesGrid} from 'sentry/components/stackTrace/frame/frameVariablesGrid';
import {FrameVariablesTree} from 'sentry/components/stackTrace/frame/frameVariablesTree';
import * as Storybook from 'sentry/stories';
import type {FrameVariable} from 'sentry/types/event';
import type {Meta} from 'sentry/types/group';
import {OrganizationContext} from 'sentry/utils/organizationContext';
import {useOrganization} from 'sentry/utils/useOrganization';

const filteredMeta: Partial<Meta> = {rem: [['project:0', 'x']]};
const replacedMeta: Partial<Meta> = {rem: [['project:0', 's']]};
const maskedAuthorization = 'Bearer ********abcd';
const maskedMeta: Partial<Meta> = {
  rem: [['project:0', 'm', 7, 15]],
  chunks: [
    {type: 'text', text: 'Bearer ', rule_id: ''},
    {type: 'redaction', text: '********', rule_id: 'project:0', remark: 'm'},
    {type: 'text', text: 'abcd', rule_id: ''},
  ],
};
const omittedMeta: Partial<Meta> = {rem: [['!config', 'x']]};
const truncatedMessagePrefix = 'The request was interrupted while processing';
const truncatedMessage = `${truncatedMessagePrefix}...`;
const truncatedStringMeta: Partial<Meta> = {
  len: 128,
  rem: [['!limit', 'x']],
  chunks: [
    {type: 'text', text: truncatedMessagePrefix, rule_id: ''},
    {type: 'redaction', text: '...', rule_id: '!limit', remark: 'x'},
  ],
};
const truncatedItemsMeta: Partial<Meta> = {len: 5, rem: [['!limit', 'x']]};

// Synthetic extracted values for previewing the typed native experience.
const extractedNativeVariables: FrameVariable[] = [
  {
    name: 'player',
    type: 'Player *',
    kind: 'object',
    children: [
      {name: 'id', type: 'int', kind: 'number', value: '1'},
      {name: 'name', type: 'char[64]', kind: 'string', value: 'Alice'},
      {name: 'status', type: 'RequestStatus', kind: 'enum', value: 'STATUS_OK'},
      {
        name: 'position',
        type: 'Vec3',
        kind: 'object',
        children: [
          {name: 'x', type: 'float', kind: 'number', value: '1.5'},
          {name: 'y', type: 'float', kind: 'number', value: '-3.2'},
          {name: 'z', type: 'float', kind: 'number', value: '0.0'},
        ],
      },
      {name: 'health', type: 'float', kind: 'number', value: '-5.5'},
      {name: 'access_token', type: 'char *', kind: 'unavailable', meta: filteredMeta},
      {
        name: 'authorization',
        type: 'char[32]',
        kind: 'string',
        value: maskedAuthorization,
        meta: maskedMeta,
      },
      {
        name: 'inventory',
        type: 'Inventory *',
        kind: 'object',
        children: [
          {name: 'capacity', type: 'int', kind: 'number', value: '16'},
          {name: 'count', type: 'int', kind: 'number', value: '5'},
          {
            name: 'items',
            type: 'int[5]',
            kind: 'array',
            meta: truncatedItemsMeta,
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
  {
    name: 'm_attachmentDescriptorPoolAllocator',
    type: 'vk::DescriptorPoolAllocator *',
    kind: 'object',
    children: [
      {name: 'capacity', type: 'uint32_t', kind: 'number', value: '128'},
      {name: 'allocated', type: 'uint32_t', kind: 'number', value: '12'},
    ],
  },
  {name: 'address', type: 'void *', kind: 'pointer', value: '0xffffffffffffffff'},
  {name: 'null_player', type: 'Player *', kind: 'null'},
  {name: 'status_ptr', type: 'RequestStatus *', kind: 'unavailable'},
  {name: 'empty_array', type: 'std::vector<int>', kind: 'array', children: []},
  {name: 'empty_object', type: 'Empty', kind: 'object', children: []},
  {name: 'sdk_omitted', type: 'char *', kind: 'unavailable', meta: omittedMeta},
  {
    name: 'raw_omitted',
    type: 'char *',
    kind: 'unavailable',
    meta: {rem: [['!raw', 'x']]},
  },
  {
    name: 'replaced_token',
    type: 'char *',
    kind: 'string',
    value: '[Filtered]',
    meta: replacedMeta,
  },
  {
    name: 'omitted_items',
    type: 'int[5]',
    kind: 'array',
    children: [],
    meta: truncatedItemsMeta,
  },
  {name: 'zero', type: 'int', kind: 'number', value: '0'},
  {
    name: 'large_counter',
    type: 'uint64_t',
    kind: 'number',
    value: '18446744073709551615',
  },
  {name: 'enabled', type: 'bool', kind: 'boolean', value: 'true'},
  {
    name: 'truncated_message',
    type: 'char[128]',
    kind: 'string',
    value: truncatedMessage,
    meta: truncatedStringMeta,
  },
];

const jsonVariables = {
  count: 42,
  enabled: true,
  player: {
    name: 'Alice',
    position: {x: 1.5, y: -3.2, z: 0},
    access_token: null,
    authorization: maskedAuthorization,
  },
  items: [1, 2, 3],
  empty: null,
  empty_array: [],
  empty_object: {},
  message: '0x2a (int)',
  sdk_omitted: null,
  raw_omitted: null,
  replaced_token: '[Filtered]',
  omitted_items: [],
  truncated_message: truncatedMessage,
};

const jsonMeta = {
  player: {
    access_token: {'': filteredMeta},
    authorization: {'': maskedMeta},
  },
  items: {'': truncatedItemsMeta},
  sdk_omitted: {'': omittedMeta},
  raw_omitted: {'': {rem: [['!raw', 'x']]}},
  replaced_token: {'': replacedMeta},
  omitted_items: {'': truncatedItemsMeta},
  truncated_message: {'': truncatedStringMeta},
};

const nativeVariables = {
  count: '0x2a (int)',
  damage: '0x3fc00000 (float)',
  player: '0x16dc05ff0 (void*)',
  null_pointer: '0x0 (int*)',
  local_counter: 'int',
  health_ptr: 'float*',
  unknown_type: '<unknown>',
  access_token: '[Filtered]',
  sdk_omitted: null,
  truncated_message: truncatedMessage,
};

const nativeMeta = {
  access_token: {'': replacedMeta},
  sdk_omitted: {'': omittedMeta},
  truncated_message: {'': truncatedStringMeta},
};

export default Storybook.story('Frame variables', story => {
  story('Extracted native variables', () => (
    <Stack gap="lg">
      <Text>Preview of extracted native values with types and nested fields.</Text>
      <Container maxWidth="960px" borderTop="primary">
        <FrameVariablesTree
          variables={extractedNativeVariables}
          defaultExpanded={['player']}
        />
      </Container>
    </Stack>
  ));

  story('JSON variables', () => (
    <VariableStory>
      <FrameVariablesGrid platform="node" data={jsonVariables} meta={jsonMeta} />
    </VariableStory>
  ));

  story('Current native wire values', () => (
    <VariableStory>
      <FrameVariablesGrid platform="native" data={nativeVariables} meta={nativeMeta} />
    </VariableStory>
  ));

  story('Python variables', () => (
    <VariableStory>
      <FrameVariablesGrid
        platform="python"
        data={{
          "'status'": 'True',
          "'empty'": 'None',
          "'count'": '18446744073709551615',
          "'message'": "'hello world'",
          "'client'": '<Client at 0x12345>',
          "'items'": ['1', '2'],
        }}
        meta={{"'items'": {'': truncatedItemsMeta}}}
      />
    </VariableStory>
  ));
});

/** Toggle the real product flag so each fixture exercises both rendering paths. */
function VariableStory({children}: {children: ReactNode}) {
  const checkboxId = useId();
  const organization = useOrganization();
  const [enabled, setEnabled] = useState(true);
  const features = organization.features.filter(
    feature => feature !== 'native-variable-extraction'
  );
  if (enabled) {
    features.push('native-variable-extraction');
  }

  return (
    <OrganizationContext.Provider value={{...organization, features}}>
      <Stack gap="lg">
        <Flex as="label" align="center" gap="sm" htmlFor={checkboxId}>
          <Checkbox
            id={checkboxId}
            checked={enabled}
            onChange={() => setEnabled(value => !value)}
          />
          <Text>Use new variable UI</Text>
        </Flex>
        <Container maxWidth="960px">{children}</Container>
      </Stack>
    </OrganizationContext.Provider>
  );
}
