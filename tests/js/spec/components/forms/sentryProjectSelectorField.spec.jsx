import React from 'react';

import {mount} from 'sentry-test/enzyme';
import {selectByValue} from 'sentry-test/select-new';

import SentryProjectSelectorField from 'app/views/settings/components/forms/sentryProjectSelectorField';

describe('SentryProjectSelectorField', () => {
  it('can change values', () => {
    const mock = jest.fn();
    const projects = [
      TestStubs.Project(),
      TestStubs.Project({
        id: '23',
        slug: 'my-proj',
        name: 'My Proj',
      }),
    ];
    const wrapper = mount(
      <SentryProjectSelectorField onChange={mock} name="project" projects={projects} />
    );

    selectByValue(wrapper, '23', {control: true});
    expect(mock).toHaveBeenCalledWith('23', expect.anything());
  });
});
