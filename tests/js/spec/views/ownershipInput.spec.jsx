import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';

import OwnerInput from 'app/views/settings/project/projectOwnership/ownerInput';

jest.mock('jquery');
describe('Project Ownership Input', function() {
  let org;
  let project;
  let put;

  beforeEach(function() {
    org = TestStubs.Organization();
    project = TestStubs.Project();

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/members/',
      method: 'GET',
      body: [TestStubs.Members()],
    });
    put = MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/ownership/`,
      method: 'PUT',
      body: {raw: 'url:src @dummy@example.com'},
    });
  });

  it('renders', function() {
    const wrapper = mountWithTheme(
      <OwnerInput
        params={{orgId: org.slug, projectId: project.slug}}
        organization={org}
        initialText="url:src @dummy@example.com"
        project={project}
      />,
      TestStubs.routerContext()
    );

    const submit = wrapper.find('SaveButton button');

    expect(put).not.toHaveBeenCalled();

    // if text is unchanged, submit button is disabled
    submit.simulate('click');
    expect(put).not.toHaveBeenCalled();

    wrapper.find('StyledTextArea').simulate('change', {target: {value: 'new'}});

    submit.simulate('click');

    expect(put).toHaveBeenCalled();

    expect(wrapper.find(OwnerInput)).toSnapshot();
  });
});
