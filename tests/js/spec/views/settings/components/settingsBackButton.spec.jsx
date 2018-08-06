import React from 'react';
import {mount} from 'enzyme';

import {BackButton} from 'app/views/settings/components/settingsBackButton';

describe('SettingsBackButton', function() {
  const project = TestStubs.Project();
  const org = TestStubs.Organization();

  describe('No Context From App', function() {
    it('renders "Back to Organization" when no project slug', function() {
      let wrapper = mount(<BackButton params={{}} organization={org} />);
      expect(wrapper.find('BackButtonWrapper').text()).toBe('Back to Organization');
      expect(wrapper.find('BackButtonWrapper').prop('to')).toBe('/org-slug/');
    });

    it('renders "Back to Project" only when projectId is present in route', function() {
      let wrapper = mount(
        <BackButton params={{projectId: 'project-slug'}} organization={org} />
      );
      expect(wrapper.find('BackButtonWrapper').text()).toBe('Back to Project');
      expect(wrapper.find('BackButtonWrapper').prop('to')).toBe(
        '/org-slug/project-slug/'
      );
    });

    it('uses "last route" when provided', function() {
      let wrapper = mount(
        <BackButton
          lastRoute="/org-slug/project-slug/foo/bar/"
          params={{}}
          organization={org}
          project={project}
        />
      );
      expect(wrapper.find('BackButtonWrapper').prop('to')).toBe(
        '/org-slug/project-slug/foo/bar/'
      );
    });
  });

  describe('With Context From App', function() {
    it('renders "Back to Project" only if `lastAppContext` is "project"', function() {
      let wrapper = mount(
        <BackButton
          params={{projectId: 'project-slug'}}
          organization={org}
          lastRoute="/foo/"
          project={project}
        />,
        {
          context: {
            lastAppContext: 'project',
          },
        }
      );
      expect(wrapper.find('BackButtonWrapper').text()).toBe('Back to Project');
      expect(wrapper.find('BackButtonWrapper').prop('to')).toBe('/foo/');
    });

    it('renders "Back to Organization" if `lastAppContext` is "organization", even with projectId in route ', function() {
      let wrapper = mount(
        <BackButton params={{projectId: 'project-slug'}} organization={org} />,
        {
          context: {
            lastAppContext: 'organization',
          },
        }
      );
      expect(wrapper.find('BackButtonWrapper').text()).toBe('Back to Organization');
      expect(wrapper.find('BackButtonWrapper').prop('to')).toBe('/org-slug/');
    });
  });
});
