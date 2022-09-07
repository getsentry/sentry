import {act, render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {createProject} from 'sentry/actionCreators/projects';
import TeamStore from 'sentry/stores/teamStore';
import OnboardingPlatform from 'sentry/views/onboarding/platform';

jest.mock('sentry/actionCreators/projects');

describe('OnboardingWelcome', function () {
  afterEach(() => {
    jest.resetAllMocks();
  });

  it('calls onUpdate when setting the platform', function () {
    const onUpdate = jest.fn();

    render(<OnboardingPlatform active onUpdate={onUpdate} />);

    userEvent.click(screen.getByTestId('platform-dotnet'));

    expect(onUpdate).toHaveBeenCalled();
  });

  it('creates a project when no project exists', async function () {
    const onComplete = jest.fn();

    const wrapper = render(<OnboardingPlatform active onComplete={onComplete} />);

    // Select a platform to create
    wrapper.rerender(
      <OnboardingPlatform active onComplete={onComplete} platform="dotnet" />
    );
    act(() => {
      TeamStore.loadInitialData([{id: '1', slug: 'team-slug'}]);
    });
    const button = screen.getByRole('button', {name: 'Create Project'});
    expect(button).toBeInTheDocument();
    expect(button).toBeEnabled();

    let resolveProjectCreate;
    createProject.mockReturnValue(
      new Promise(resolve => (resolveProjectCreate = resolve))
    );

    // Create the project
    userEvent.click(button);

    expect(button).toHaveTextContent('Creating Project...');

    // Project completed creation (tick for async completion)
    resolveProjectCreate({id: 1, slug: 'test-project'});

    wrapper.rerender(
      <OnboardingPlatform active={false} onComplete={onComplete} platform="dotnet" />
    );
    expect(button).toHaveTextContent('Project Created');
    await waitFor(() => expect(onComplete).toHaveBeenCalled());
  });

  it('does not create a project if one already exists', async function () {
    const onComplete = jest.fn();

    render(
      <OnboardingPlatform
        active
        project={{id: '1', slug: 'test'}}
        platform="dotnet"
        onComplete={onComplete}
      />
    );

    act(() => {
      TeamStore.loadInitialData([{id: '1', slug: 'team-slug'}]);
    });
    const button = screen.getByRole('button', {name: 'Set Up Your Project'});
    expect(button).toBeInTheDocument();
    expect(button).toBeEnabled();

    // Create the project
    userEvent.click(button);

    expect(button).toBeDisabled();
    expect(createProject).not.toHaveBeenCalled();
    await waitFor(() => expect(onComplete).toHaveBeenCalled());
  });
});
