import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';

import Content from 'app/views/settings/components/dataScrubbing/content';
import convertRelayPiiConfig from 'app/views/settings/components/dataScrubbing/convertRelayPiiConfig';

// @ts-ignore
const relayPiiConfig = TestStubs.DataScrubbingRelayPiiConfig();
const stringRelayPiiConfig = JSON.stringify(relayPiiConfig);
const convertedRules = convertRelayPiiConfig(stringRelayPiiConfig);

const handleEditRule = jest.fn();
const handleDelete = jest.fn();

describe('Content', () => {
  it('default render - empty', () => {
    const wrapper = mountWithTheme(
      <Content
        rules={[]}
        onUpdateRule={handleEditRule}
        onDeleteRule={handleDelete}
        errors={{}}
      />
    );
    expect(wrapper.text()).toEqual('You have no data scrubbing rules');
  });

  it('render rules', () => {
    const wrapper = mountWithTheme(
      <Content
        rules={convertedRules}
        onUpdateRule={handleEditRule}
        onDeleteRule={handleDelete}
        errors={{}}
      />
    );
    expect(wrapper.find('List')).toHaveLength(1);
  });
});
