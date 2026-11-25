import type {ReactNode} from 'react';
import {useId, useState} from 'react';

import {Checkbox} from '@sentry/scraps/checkbox';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import * as Storybook from 'sentry/stories';
import type {NativeFrameVariable} from 'sentry/types/event';
import type {Meta} from 'sentry/types/group';
import {OrganizationContext} from 'sentry/utils/organizationContext';
import {useOrganization} from 'sentry/utils/useOrganization';

import {FrameVariablesGrid} from './frameVariablesGrid';

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

// Modeled on a crash of https://github.com/getsentry/varcrash-example, in Symbolicator's schema.
const extractedNativeVariables = {
  frame_number: {kind: 'parameter', type: 'int', value: 1},
  player: {
    kind: 'parameter',
    type: 'Player*',
    pointer_address: ['0x000000016b29a450'],
    // Members are in alphabetical order, as Relay stores them.
    members: {
      health: {type: 'float', value: -5.5},
      id: {type: 'int', value: 1},
      inventory: {type: 'int*', pointer_address: ['0x000000016b29a540'], value: 42},
      inventory_count: {type: 'size_t', value: 5},
      name: {type: ''},
      position: {
        type: 'Vec3',
        members: {
          x: {type: 'double', value: 102},
          y: {type: 'double', value: 197.1},
          z: {type: 'double', value: 50},
        },
      },
      status: {type: 'RequestStatus'},
    },
  },
  health_ptr: {
    kind: 'local',
    type: 'float*',
    pointer_address: ['0x000000016b29a4b0'],
    value: -5.5,
  },
  player_ref: {
    kind: 'local',
    type: 'Player**',
    pointer_address: ['0x000000016b29a430', '0x000000016b29a450'],
    members: {id: {type: 'int', value: 1}},
  },
  map_name: {
    kind: 'local',
    type: 'char*',
    pointer_address: ['0x0000000104b64b33'],
    value: 'de_dust2',
  },
  null_player: {kind: 'local', type: 'Player*', pointer_address: ['0x0000000000000000']},
  dangling: {
    kind: 'local',
    type: 'Player**',
    pointer_address: ['0x000000016b29a430', '0x0000000000000000'],
  },
  unmapped: {kind: 'local', type: 'void*', pointer_address: ['0xffffffffffffffff']},
  buffer: {kind: 'local', type: ''},
  initial: {kind: 'local', type: 'char', value: "'A'"},
  enabled: {kind: 'local', type: 'bool', value: true},
  wide_counter: {
    kind: 'local',
    type: '__uint128_t',
    value: '340282366920938463463374607431768211455',
  },
  opaque: {
    kind: 'local',
    type: '<unknown>',
    value: ['0x2a', '0x00', '0xff', '0x10', '... (12 bytes truncated) ...'],
  },
  access_token: {
    kind: 'local',
    type: 'char*',
    pointer_address: ['0x000000016b29a4c0'],
    value: '[Filtered]',
  },
  truncated_message: {
    kind: 'local',
    type: 'char*',
    pointer_address: ['0x000000016b29a4e0'],
    value: truncatedMessage,
  },
} satisfies Record<string, NativeFrameVariable>;

const extractedNativeMeta = {
  access_token: {value: {'': replacedMeta}},
  truncated_message: {value: {'': truncatedStringMeta}},
};

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
  player: {access_token: {'': filteredMeta}, authorization: {'': maskedMeta}},
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
    <VariableStory>
      <Text>Variables extracted by Symbolicator from a native crash.</Text>
      <FrameVariablesGrid
        platform="native"
        data={extractedNativeVariables}
        meta={extractedNativeMeta}
      />
    </VariableStory>
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
