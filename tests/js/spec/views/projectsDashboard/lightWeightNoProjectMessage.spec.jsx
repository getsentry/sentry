import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';

import LightWeightNoProjectMessage from 'app/components/lightWeightNoProjectMessage';
import ProjectsStore from 'app/stores/projectsStore';

describe('LightWeightNoProjectMessage', function() {
  beforeEach(function() {
    ProjectsStore.reset();
  });

  it('renders', async function() {
    const project1 = TestStubs.Project();
    const project2 = TestStubs.Project();
    const organization = TestStubs.Organization({slug: 'org-slug'});
    delete organization.projects;
    ProjectsStore.loadInitialData([project1, project2]);
    const wrapper = mountWithTheme(
      <LightWeightNoProjectMessage organization={organization}>
        {null}
      </LightWeightNoProjectMessage>,
      TestStubs.routerContext()
    );
    expect(wrapper.prop('children')).toBe(null);
    expect(wrapper.find('NoProjectMessage').exists()).toBe(true);
  });

  it('does not remount when the projects store loads', async function() {
    const mount = jest.fn();
    const unmount = jest.fn();
    class MockComponent extends React.Component {
      componentWillMount() {
        mount();
      }
      componentWillUnmount() {
        unmount();
      }
      render() {
        return <div>children</div>;
      }
    }

    const project1 = TestStubs.Project();
    const project2 = TestStubs.Project();
    const organization = TestStubs.Organization({slug: 'org-slug'});
    delete organization.projects;
    const wrapper = mountWithTheme(
      <LightWeightNoProjectMessage organization={organization}>
        <MockComponent />
      </LightWeightNoProjectMessage>,
      TestStubs.routerContext()
    );

    // verify MockComponent is mounted once
    expect(mount).toHaveBeenCalledTimes(1);
    expect(wrapper.find('NoProjectMessage')).toHaveLength(1);
    expect(wrapper.find('NoProjectMessage').prop('loadingProjects')).toEqual(true);
    ProjectsStore.loadInitialData([project1, project2]);
    // await for trigger from projects store to resolve
    await tick();
    wrapper.update();

    // verify MockComponent is not unmounted and is still mounted once
    expect(unmount).toHaveBeenCalledTimes(0);
    expect(mount).toHaveBeenCalledTimes(1);
    expect(wrapper.find('NoProjectMessage')).toHaveLength(1);
    expect(wrapper.find('NoProjectMessage').prop('loadingProjects')).toEqual(false);
  });
});
