import {browserHistory} from 'react-router';
import React from 'react';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {mountWithTheme} from 'sentry-test/enzyme';

import Onboarding, {stepPropTypes} from 'app/views/onboarding/onboarding';
import ProjectsStore from 'app/stores/projectsStore';

const MockStep = ({
  name,
  data,
  scrollTargetId,
  active,
  project,
  onReturnToStep,
  onComplete,
  onUpadte,
}) => (
  <div>
    {active && <div id="is_active" />}
    <div id="step_name" data-scroll-id={scrollTargetId}>
      {name}
    </div>
    <div id="project_slug">{project && project.slug}</div>
    <a id="complete" href="#" onClick={() => onComplete(data)} />
    <a id="update" href="#" onClick={() => onUpadte(data)} />
    <a id="return" href="#" onClick={() => onReturnToStep(data)} />
  </div>
);

MockStep.propTypes = stepPropTypes;

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

    mountWithTheme(
      <Onboarding steps={MOCKED_STEPS} params={params} />,
      TestStubs.routerContext()
    );

    expect(browserHistory.replace).toHaveBeenCalledWith('/onboarding/org-bar/step1/');
  });

  it('renders one step', function () {
    const params = {
      step: 'step1',
      orgId: 'org-bar',
    };

    const wrapper = mountWithTheme(
      <Onboarding steps={MOCKED_STEPS} params={params} />,
      TestStubs.routerContext()
    );

    // Validate that there is only one step
    expect(wrapper.find('#step_name')).toHaveLength(1);
    expect(wrapper.find('#step_name').text()).toEqual('step_1');
    expect(wrapper.find('PageHeading').text()).toEqual('Step One');
    expect(wrapper.find('ProgressStatus').text()).toEqual('Step One');
    expect(wrapper.find('#is_active').exists()).toEqual(true);

    // Validate that the progress bar is displayed and active
    expect(wrapper.find('ProgressStep')).toHaveLength(3);
    expect(wrapper.find('ProgressStep').first().props().active).toBe(true);
  });

  it('moves to next step on complete', function () {
    browserHistory.replace = jest.fn();

    const params = {
      step: 'step1',
      orgId: 'org-bar',
    };

    const wrapper = mountWithTheme(
      <Onboarding steps={MOCKED_STEPS} params={params} />,
      TestStubs.routerContext()
    );

    wrapper.find('#complete').simulate('click');
    expect(browserHistory.push).toHaveBeenCalledWith('/onboarding/org-bar/step2/');
  });

  it('renders first and second step', function () {
    const params = {
      step: 'step2',
      orgId: 'org-bar',
    };

    const wrapper = mountWithTheme(
      <Onboarding steps={MOCKED_STEPS} params={params} />,
      TestStubs.routerContext()
    );

    // Validate both steps exist
    expect(wrapper.find('ProgressStatus').text()).toEqual('Step Two');
    expect(wrapper.find('#step_name')).toHaveLength(2);
    expect(wrapper.find('#step_name').at(1).text()).toEqual('step_2');

    // First step is not active
    expect(wrapper.find('MockStep').at(0).find('#active').exists()).toBe(false);

    // Second step is active
    expect(wrapper.find('MockStep').at(1).find('#active').exists()).toBe(false);
  });

  it('returns to step one when onReturnToStep is triggered', function () {
    browserHistory.replace = jest.fn();

    const params = {
      step: 'step2',
      orgId: 'org-bar',
    };

    const wrapper = mountWithTheme(
      <Onboarding steps={MOCKED_STEPS} params={params} />,
      TestStubs.routerContext()
    );

    wrapper.find('#return').at(0).simulate('click');
    expect(browserHistory.push).toHaveBeenCalledWith('/onboarding/org-bar/step1/');
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

    ProjectsStore.loadInitialData(projects);

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
