import React from 'react';
import {mountWithTheme} from 'sentry-test/enzyme';
import ProjectList from 'app/views/releases/list/projectList.tsx';

const projects = [
  {slug: 'test1'},
  {slug: 'test2'},
  {slug: 'test3'},
  {slug: 'test4'},
  {slug: 'test5'},
];

describe('ProjectList', () => {
  it('shows the correct amount of projects and hide the rest', () => {
    const wrapper = mountWithTheme(<ProjectList maxLines={3} projects={projects} />);
    expect(wrapper.find('StyledProjectBadge').length).toBe(2);
    expect(wrapper.find('StyledDropdownAutoComplete').text()).toBe('and 3 more');
  });
});
