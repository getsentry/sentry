import {browserHistory} from 'react-router';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {act, render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import ProjectsStore from 'sentry/stores/projectsStore';
import Onboarding from 'sentry/views/onboarding/onboarding';

const MockStep = ({name, data, active, project, onComplete, onUpadte}) => (
  <div>
    {active && <div data-test-id="is_active" />}
    <div data-test-id="step_name">{name}</div>
    <div data-test-id="project_slug">{project && project.slug}</div>
    <a data-test-id="complete" href="#" onClick={() => onComplete(data)} />
    <a data-test-id="update" href="#" onClick={() => onUpadte(data)} />
  </div>
);

const makeMockStep = preFill => p => <MockStep {...preFill} {...p} />;

const MOCKED_STEPS = [
  {
    id: 'step1',
    title: 'Step One',
    Component: makeMockStep({name: 'step_1', data: {}}),
  },
  {
    id: 'step2',
    title: 'Step Two',
    Component: makeMockStep({name: 'step_2', data: {}}),
  },
  {
    id: 'step3',
    title: 'Step Three',
    Component: makeMockStep({name: 'step_3', data: {}}),
  },
];

describe('Onboarding', function () {
  it('redirects to first step if invalid step ID present', function () {
    browserHistory.replace = jest.fn();

    const params = {
      step: 'bad-step',
      orgId: 'org-bar',
    };

    render(<Onboarding steps={MOCKED_STEPS} params={params} />, {});

    expect(browserHistory.replace).toHaveBeenCalledWith('/onboarding/org-bar/step1/');
  });

  it('renders one step', function () {
    const params = {
      step: 'step1',
      orgId: 'org-bar',
    };

    render(<Onboarding steps={MOCKED_STEPS} params={params} />);

    // Validate that the first step is shown
    expect(screen.getByTestId('step_name')).toHaveTextContent('step_1');

    // Validate that the progress bar is displayed and active
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1');
  });

  it('moves to next step on complete', function () {
    browserHistory.replace = jest.fn();

    const params = {
      step: 'step1',
      orgId: 'org-bar',
    };

    render(<Onboarding steps={MOCKED_STEPS} params={params} />);

    userEvent.click(screen.getByTestId('complete'));
    expect(browserHistory.push).toHaveBeenCalledWith('/onboarding/org-bar/step2/');
  });

  it('renders second step', function () {
    const params = {
      step: 'step2',
      orgId: 'org-bar',
    };

    render(<Onboarding steps={MOCKED_STEPS} params={params} />);

    // Validate that second step is visible
    expect(screen.getByTestId('step_name')).toHaveTextContent('step_2');
    expect(screen.getByTestId('is_active')).toBeInTheDocument();
  });

  it('goes back when back button clicked', function () {
    browserHistory.push = jest.fn();

    const params = {
      step: 'step2',
      orgId: 'org-bar',
    };

    render(<Onboarding steps={MOCKED_STEPS} params={params} />);

    userEvent.click(screen.getByRole('button', {name: 'Go back'}));
    expect(browserHistory.replace).toHaveBeenCalledWith('/onboarding/org-bar/step1/');
  });

  it('passes the first existing project', function () {
    const {organization, projects, routerContext} = initializeOrg({
      // Multiple projects with different creation dates, to ensure it picks
      // the oldest project
      projects: [
        {id: 1, slug: 'first', dateCreated: 'May 16 2019 13:55:20 GMT-0700'},
        {id: 2, slug: 'second', dateCreated: 'May 17 2019 13:55:20 GMT-0700'},
      ],
    });

    act(() => ProjectsStore.loadInitialData(projects));

    const params = {
      step: 'step1',
      orgId: organization.slug,
    };

    render(<Onboarding steps={MOCKED_STEPS} params={params} />, {context: routerContext});

    expect(screen.getByTestId('project_slug')).toHaveTextContent('first');
  });
});
