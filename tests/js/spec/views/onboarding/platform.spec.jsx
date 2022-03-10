import {mountWithTheme} from 'sentry-test/enzyme';
import {act} from 'sentry-test/reactTestingLibrary';

import {createProject} from 'sentry/actionCreators/projects';
import TeamStore from 'sentry/stores/teamStore';
import OnboardingPlatform from 'sentry/views/onboarding/platform';

jest.mock('sentry/actionCreators/projects');

describe('OnboardingWelcome', function () {
  it('calls onUpdate when setting the platform', function () {
    const onUpdate = jest.fn();

    const wrapper = mountWithTheme(<OnboardingPlatform active onUpdate={onUpdate} />);

    wrapper.find('[data-test-id="platform-dotnet"]').first().simulate('click');

    expect(onUpdate).toHaveBeenCalled();
  });

  it('creates a project when no project exists', async function () {
    const onComplete = jest.fn();

    const wrapper = mountWithTheme(<OnboardingPlatform active onComplete={onComplete} />);

    const getButton = () => wrapper.find('Button[priority="primary"]');

    // Select a platform to create
    wrapper.setProps({platform: 'dotnet'});
    act(() => {
      TeamStore.loadInitialData([{id: '1', slug: 'team-slug'}]);
    });
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
      />
    );

    const getButton = () => wrapper.find('Button[priority="primary"]');

    act(() => {
      TeamStore.loadInitialData([{id: '1', slug: 'team-slug'}]);
    });
    expect(getButton().text()).toEqual('Set Up Your Project');
    expect(getButton().props().disabled).toBe(false);

    // Create the project
    getButton().simulate('click');
    await tick();

    expect(getButton().props().disabled).toBe(true);
    expect(createProject).not.toHaveBeenCalled();
    expect(onComplete).toHaveBeenCalled();
  });
});
