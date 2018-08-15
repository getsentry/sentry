import React from 'react';
import {mount} from 'enzyme';

import {Client} from 'app/api';
import OrganizationContext from 'app/views/organizationContext';
import SettingsProjectProvider from 'app/views/settings/components/settingsProjectProvider';
import SettingsWrapper from 'app/views/settings/components/settingsWrapper';
import ProjectOwnership from 'app/views/settings/project/projectOwnership';

describe('ProjectTeamsSettings', function() {
  let org;
  let project;

  beforeEach(function() {
    org = TestStubs.Organization();
    project = TestStubs.ProjectDetails();

    Client.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/`,
      method: 'GET',
      body: project,
    });
    Client.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/ownership/`,
      method: 'GET',
      body: {raw: 'url:src @dummy@example.com', fallthrough: 'false'},
    });
  });

  describe('render()', function() {
    it('renders', async function() {
      let wrapper = mount(
        <OrganizationContext params={{orgId: 'org-slug'}}>
          <SettingsWrapper>
            <SettingsProjectProvider>
              <ProjectOwnership
                params={{orgId: org.slug, projectId: project.slug}}
                organization={org}
                project={project}
              />
            </SettingsProjectProvider>
          </SettingsWrapper>
        </OrganizationContext>,
        TestStubs.routerContext()
      );
      await expect(wrapper).toSnapshot();
    });
  });
});
