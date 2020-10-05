import React from 'react';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {mountWithTheme} from 'sentry-test/enzyme';

import OnboardingHovercard from 'app/views/settings/projectAlerts/onboardingHovercard';
import {updateOnboardingTask} from 'app/actionCreators/onboardingTasks';

jest.mock('app/actionCreators/onboardingTasks');

describe('OnboardingHovercard', function () {
  const {organization, routerContext} = initializeOrg();

  it('is hidden when onboardingTask is not in the query string', function () {
    const wrapper = mountWithTheme(
      <OnboardingHovercard
        api={MockApiClient}
        organization={organization}
        location={{query: {}}}
      >
        Content
      </OnboardingHovercard>,
      routerContext
    );

    expect(wrapper.find('Hovercard').exists()).toBeFalsy();
  });

  it('is hidden when the alert rule task is not complete', function () {
    const completedOnboardingOrg = {
      ...organization,
      onboardingTasks: [{task: 'setup_alert_rules', status: 'complete'}],
    };

    const wrapper = mountWithTheme(
      <OnboardingHovercard
        api={MockApiClient}
        organization={completedOnboardingOrg}
        location={{query: {onboardingTask: null}}}
      >
        Content
      </OnboardingHovercard>,
      routerContext
    );

    expect(wrapper.find('Hovercard').exists()).toBeFalsy();
    return;
  });

  it('updates the onboarding task when the default alert rules button is clicked', function () {
    const wrapper = mountWithTheme(
      <OnboardingHovercard
        api={MockApiClient}
        organization={organization}
        location={{query: {onboardingTask: null}}}
      >
        Content
      </OnboardingHovercard>,
      routerContext
    );

    wrapper.find('Button').simulate('click');

    expect(updateOnboardingTask).toHaveBeenCalled();
  });

  it('renders', function () {
    const wrapper = mountWithTheme(
      <OnboardingHovercard
        api={MockApiClient}
        organization={organization}
        location={{query: {onboardingTask: null}}}
      >
        Content
      </OnboardingHovercard>,
      routerContext
    );

    expect(wrapper.find('Hovercard').exists()).toBeTruthy();
  });
});
