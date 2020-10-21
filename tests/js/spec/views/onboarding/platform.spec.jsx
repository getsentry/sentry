import {mountWithTheme} from 'sentry-test/enzyme';

import {createProject} from 'app/actionCreators/projects';
import OnboardingPlatform from 'app/views/onboarding/platform';
import TeamStore from 'app/stores/teamStore';

jest.mock('app/actionCreators/projects');

describe('OnboardingWelcome', function () {
  it('calls onUpdate when setting the platform', function () {
    const onUpdate = jest.fn();

    const wrapper = mountWithTheme(
      <OnboardingPlatform active onUpdate={onUpdate} />,
      TestStubs.routerContext()
    );

    wrapper.find('[data-test-id="platform-dotnet"]').first().simulate('click');

    expect(onUpdate).toHaveBeenCalled();
  });

  it('calls onReturnToStep when clearing the platform', function () {
    const onUpdate = jest.fn();
    const onReturnToStep = jest.fn();

    const wrapper = mountWithTheme(
      <OnboardingPlatform
        platform="dotnet"
        onUpdate={onUpdate}
        onReturnToStep={onReturnToStep}
      />,
      TestStubs.routerContext()
    );

    wrapper.find('ClearButton').first().simulate('click');

    expect(onReturnToStep).toHaveBeenCalled();
  });

  it('creates a project when no project exists', async function () {
    const onComplete = jest.fn();

    const wrapper = mountWithTheme(
      <OnboardingPlatform active onComplete={onComplete} />,
      TestStubs.routerContext()
    );

    const getButton = () => wrapper.find('Button[priority="primary"]');

    expect(getButton().props().disabled).toBe(true);

    // Select a platform to create
    wrapper.setProps({platform: 'dotnet'});
    TeamStore.loadInitialData([{id: '1', slug: 'team-slug'}]);
    expect(getButton().text()).toEqual('Create Project');
    expect(getButton().props().disabled).toBe(false);

    let resolveProjectCreate;
    createProject.mockReturnValue(
      new Promise(resolve => (resolveProjectCreate = resolve))
    );

    // Create the project
    getButton().simulate('click');

    expect(getButton().text()).toEqual('Creating Project...');

    // Project completed creation (tick for async completion)
    resolveProjectCreate({id: 1, slug: 'test-project'});
    await tick();

    wrapper.setProps({active: false});
    expect(getButton().text()).toEqual('Project Created');
    expect(onComplete).toHaveBeenCalled();
  });

  it('does not create a project if one already exists', async function () {
    createProject.mockReset();
    const onComplete = jest.fn();

    const wrapper = mountWithTheme(
      <OnboardingPlatform
        active
        project={{id: '1', slug: 'test'}}
        platform="dotnet"
        onComplete={onComplete}
      />,
      TestStubs.routerContext()
    );

    const getButton = () => wrapper.find('Button[priority="primary"]');

    TeamStore.loadInitialData([{id: '1', slug: 'team-slug'}]);
    expect(getButton().text()).toEqual('Setup Your Project');
    expect(getButton().props().disabled).toBe(false);

    // Create the project
    getButton().simulate('click');
    await tick();

    expect(getButton().props().disabled).toBe(true);
    expect(createProject).not.toHaveBeenCalled();
    expect(onComplete).toHaveBeenCalled();
  });
});
