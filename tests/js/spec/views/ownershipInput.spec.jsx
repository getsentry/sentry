import React from 'react';
import {mount} from 'enzyme';

import {ThemeProvider} from 'emotion-theming';
import theme from 'app/utils/theme';
import {Client} from 'app/api';
import OwnerInput from 'app/views/settings/project/projectOwnership/ownerInput';

jest.mock('jquery');
describe('ProjectTeamsSettings', function() {
  let org;
  let project;
  let put;

  beforeEach(function() {
    org = TestStubs.Organization();
    project = TestStubs.Project();

    put = Client.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/ownership/`,
      method: 'PUT',
      body: {raw: 'url:src @dummy@example.com'},
    });
  });

  describe('render()', function() {
    it('renders', function() {
      let wrapper = mount(
        <ThemeProvider theme={theme}>
          <OwnerInput
            params={{orgId: org.slug, projectId: project.slug}}
            organization={org}
            initialText="url:src @dummy@example.com"
            project={project}
          />
        </ThemeProvider>,
        TestStubs.routerContext()
      );

      let submit = wrapper.find('SaveButton button');

      expect(put).not.toHaveBeenCalled();

      // if text is unchanged, submit button is disabled
      submit.simulate('click');
      expect(put).not.toHaveBeenCalled();

      wrapper
        .find(OwnerInput)
        .instance()
        .onChange({target: {value: 'new'}});

      submit.simulate('click');

      expect(put).toHaveBeenCalled();

      expect(wrapper.find(OwnerInput)).toMatchSnapshot();
    });
  });
});
