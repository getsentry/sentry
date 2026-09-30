import type {ReactNode} from 'react';
import {useId, useState} from 'react';

import {Checkbox} from '@sentry/scraps/checkbox';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {FrameVariablesGrid} from 'sentry/components/stackTrace/frame/frameVariablesGrid';
import * as Storybook from 'sentry/stories';
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
  story('JSON variables', () => (
    <VariableStory>
      <FrameVariablesGrid platform="node" data={jsonVariables} meta={jsonMeta} />
    </VariableStory>
  ));

  story('JSON variables — narrow', () => (
    <VariableStory narrow>
      <FrameVariablesGrid platform="node" data={jsonVariables} meta={jsonMeta} />
    </VariableStory>
  ));

  story('Native wire values', () => (
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
function VariableStory({
  children,
  narrow = false,
}: {
  children: ReactNode;
  narrow?: boolean;
}) {
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
        <Container
          width={narrow ? '360px' : undefined}
          maxWidth={narrow ? '100%' : '960px'}
        >
          {children}
        </Container>
      </Stack>
    </OrganizationContext.Provider>
  );
}
