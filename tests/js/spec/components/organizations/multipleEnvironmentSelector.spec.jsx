import React from 'react';

import {mount} from 'enzyme';
import MultipleEnvironmentSelector from 'app/components/organizations/multipleEnvironmentSelector';

describe('MultipleEnvironmentSelector', function() {
  let wrapper;
  const onChange = jest.fn();
  const onUpdate = jest.fn();

  const envs = ['production', 'staging', 'dev'];
  const organization = TestStubs.Organization({
    projects: [
      TestStubs.Project({
        id: '1',
        slug: 'first',
        environments: ['production', 'staging'],
      }),
      TestStubs.Project({
        id: '2',
        slug: 'second',
        environments: ['dev'],
      }),
    ],
  });
  const selectedProjects = [1, 2];
  const routerContext = TestStubs.routerContext([
    {
      organization,
    },
  ]);

  beforeEach(async function() {
    onChange.mockReset();
    onUpdate.mockReset();
    wrapper = mount(
      <MultipleEnvironmentSelector
        organization={organization}
        selectedProjects={selectedProjects}
        onChange={onChange}
        onUpdate={onUpdate}
      />,
      routerContext
    );

    // Below is needed to support React.lazy/Suspense
    await tick();
    wrapper.update();
  });

  it('can select and change environments', function() {
    wrapper.find('MultipleEnvironmentSelector HeaderItem').simulate('click');

    // Select all envs
    envs.forEach((_env, i) => {
      wrapper
        .find('EnvironmentSelectorItem')
        .at(i)
        .find('CheckboxHitbox')
        .simulate('click', {});
    });
    expect(onChange).toHaveBeenCalledTimes(3);
    expect(onChange).toHaveBeenLastCalledWith(envs, expect.anything());

    wrapper
      .find('MultipleSelectorSubmitRow button[aria-label="Apply"]')
      .simulate('click');
    expect(onUpdate).toHaveBeenCalledWith();
  });

  it('selects multiple environments and uses chevron to update', function() {
    wrapper.find('MultipleEnvironmentSelector HeaderItem').simulate('click');

    wrapper
      .find('MultipleEnvironmentSelector AutoCompleteItem CheckboxHitbox')
      .at(0)
      .simulate('click');

    expect(onChange).toHaveBeenLastCalledWith(['production'], expect.anything());

    wrapper
      .find('MultipleEnvironmentSelector AutoCompleteItem CheckboxHitbox')
      .at(1)
      .simulate('click');
    expect(onChange).toHaveBeenLastCalledWith(
      ['production', 'staging'],
      expect.anything()
    );

    wrapper.find('MultipleEnvironmentSelector StyledChevron').simulate('click');
    expect(onUpdate).toHaveBeenCalledWith();
  });

  it('does not update when there are no changes', function() {
    wrapper.find('MultipleEnvironmentSelector HeaderItem').simulate('click');
    wrapper.find('MultipleEnvironmentSelector StyledChevron').simulate('click');
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('updates environment options when projects selection changes', function() {
    // project 2 only has 1 environment.
    wrapper.setProps({selectedProjects: [2]});
    wrapper.update();

    wrapper.find('MultipleEnvironmentSelector HeaderItem').simulate('click');
    const items = wrapper.find('MultipleEnvironmentSelector GlobalSelectionHeaderRow');
    expect(items.length).toEqual(1);
    expect(items.at(0).text()).toBe('dev');
  });

  it('shows the all environments when there are no projects selected', function() {
    wrapper.setProps({selectedProjects: []});
    wrapper.update();

    wrapper.find('MultipleEnvironmentSelector HeaderItem').simulate('click');
    const items = wrapper.find('MultipleEnvironmentSelector GlobalSelectionHeaderRow');

    expect(items.length).toEqual(3);
    expect(items.at(0).text()).toBe('production');
    expect(items.at(1).text()).toBe('staging');
    expect(items.at(2).text()).toBe('dev');
  });

  it('shows the distinct union of environments across all projects', function() {
    wrapper.setProps({selectedProjects: [1, 2]});
    wrapper.find('MultipleEnvironmentSelector HeaderItem').simulate('click');
    const items = wrapper.find('MultipleEnvironmentSelector GlobalSelectionHeaderRow');

    expect(items.length).toEqual(3);
    expect(items.at(0).text()).toBe('production');
    expect(items.at(1).text()).toBe('staging');
    expect(items.at(2).text()).toBe('dev');
  });
});
