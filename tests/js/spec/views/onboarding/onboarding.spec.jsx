import {browserHistory} from 'react-router';

import {mountWithTheme} from 'sentry-test/enzyme';
import {initializeOrg} from 'sentry-test/initializeOrg';
import {act} from 'sentry-test/reactTestingLibrary';

import ProjectsStore from 'sentry/stores/projectsStore';
import Onboarding from 'sentry/views/onboarding/onboarding';

const MockStep = ({name, data, active, project, onComplete, onUpadte}) => (
  <div>
    {active && <div id="is_active" />}
    <div id="step_name">{name}</div>
    <div id="project_slug">{project && project.slug}</div>
    <a id="complete" href="#" onClick={() => onComplete(data)} />
    <a id="update" href="#" onClick={() => onUpadte(data)} />
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

    mountWithTheme(<Onboarding steps={MOCKED_STEPS} params={params} />);

    expect(browserHistory.replace).toHaveBeenCalledWith('/onboarding/org-bar/step1/');
  });

  it('renders one step', function () {
    const params = {
      step: 'step1',
      orgId: 'org-bar',
    };

    const wrapper = mountWithTheme(<Onboarding steps={MOCKED_STEPS} params={params} />);

    // Validate that the first step is shown
    expect(wrapper.find('#step_name').text()).toEqual('step_1');

    // Validate that the progress bar is displayed and active
    expect(wrapper.find('ProgressStep').first().props().active).toBe(true);
  });

  it('moves to next step on complete', function () {
    browserHistory.replace = jest.fn();

    const params = {
      step: 'step1',
      orgId: 'org-bar',
    };

    const wrapper = mountWithTheme(<Onboarding steps={MOCKED_STEPS} params={params} />);

    wrapper.find('#complete').simulate('click');
    expect(browserHistory.push).toHaveBeenCalledWith('/onboarding/org-bar/step2/');
  });

  it('renders second step', function () {
    const params = {
      step: 'step2',
      orgId: 'org-bar',
    };

    const wrapper = mountWithTheme(<Onboarding steps={MOCKED_STEPS} params={params} />);

    // Validate that second step is visible
    expect(wrapper.find('#step_name').text()).toEqual('step_2');
    expect(wrapper.find('MockStep').find('#active').exists()).toBe(false);
  });

  it('goes back when back button clicked', function () {
    browserHistory.push = jest.fn();

    const params = {
      step: 'step2',
      orgId: 'org-bar',
    };

    const wrapper = mountWithTheme(<Onboarding steps={MOCKED_STEPS} params={params} />);

    wrapper.find('Back Button').simulate('click');
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

    const wrapper = mountWithTheme(
      <Onboarding steps={MOCKED_STEPS} params={params} />,
      routerContext
    );

    expect(wrapper.find('#project_slug').text()).toBe('first');
  });
});
