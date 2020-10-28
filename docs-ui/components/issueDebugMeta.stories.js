import React from 'react';
import {withInfo} from '@storybook/addon-info';

import SentryTypes from 'app/sentryTypes';
import DebugMeta from 'app/components/events/interfaces/debugMeta';

const event = {
  id: 'deadbeef',
  eventID: 'deadbeef',
  groupID: '999',
  title: 'thread failing!',
  metadata: {
    function: 'thread_demo',
    type: 'thread_demo',
    value: 'Failing!',
  },
  tags: {},
  contexts: {},
  entries: [
    {
      type: 'debugmeta',
      data: {
        images: [
          {
            code_file: '/Users/uhoh/code/thread-demo.rs',
            image_vmaddr: '0x0',
            image_addr: '0x1fe1000',
            image_size: 439486848,
            type: 'symbolic',
            debug_id: '79398811-17a9-3884-9dfb-5552eed86a6f',
            features: {
              has_debug_info: true,
              has_symbols: true,
            },
            arch: 'x86',
            debug_status: 'found',
            unwind_status: 'found',
          },
          {
            code_file: '/usr/lib/libSystem.B.dylib',
            image_vmaddr: '0x7fff335cb000',
            image_addr: '0x7fff3ff1c000',
            image_size: 439486848,
            type: 'symbolic',
            debug_id: 'dfe2454f-2fe3-3b2b-a22b-422947c34c69',
          },
          {
            code_file:
              '/System/Library/Frameworks/CoreFoundation.framework/Versions/A/CoreFoundation',
            image_vmaddr: '0x7fff279a8000',
            image_addr: '0x7fff342f9000',
            image_size: 439486848,
            type: 'symbolic',
            debug_id: '79398803-19x7-3844-9dfb-5516cca93c1a',
            debug_status: 'malformed',
            unwind_status: 'malformed',
          },
          {
            code_file:
              '/System/Library/Frameworks/CoreFoundation.framework/Versions/A/Unused',
            image_vmaddr: '0x7fff279a8000',
            image_addr: '0x7fff342f9000',
            image_size: 439486848,
            type: 'symbolic',
            debug_id: '79398803-19x7-3844-9dfb-5516cca93c1a',
            debug_status: 'unused',
            unwind_status: 'unused',
          },
        ],
      },
    },
    {
      type: 'exception',
      data: {
        values: [
          {
            stacktrace: {
              frames: [{instructionAddr: '0x1fe1000'}],
            },
          },
        ],
      },
    },
  ],
};

const organization = {
  id: '1',
  slug: 'org-slug',
  access: ['project:releases'],
};

class OrganizationContext extends React.Component {
  static childContextTypes = {
    organization: SentryTypes.Organization,
  };

  getChildContext() {
    return {organization};
  }

  render() {
    return this.props.children;
  }
}

export default {
  title: 'Features/Issues/DebugMeta',
};

export const Default = withInfo('Various debug image metadata states')(() => (
  <div className="section">
    <OrganizationContext>
      <DebugMeta
        event={event}
        data={event.entries[0].data}
        orgId={organization.id}
        projectId="1"
      />
    </OrganizationContext>
  </div>
));

Default.story = {
  name: 'default',
};
