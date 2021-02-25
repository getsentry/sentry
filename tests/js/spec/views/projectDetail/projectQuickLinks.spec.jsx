import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';
import {initializeOrg} from 'sentry-test/initializeOrg';

import ProjectQuickLinks from 'app/views/projectDetail/projectQuickLinks';

describe('ProjectDetail > ProjectQuickLinks', function () {
  const {organization, router} = initializeOrg({
    organization: {features: ['performance-view']},
  });

  it('renders a list', function () {
    const wrapper = mountWithTheme(
      <ProjectQuickLinks
        organization={organization}
        location={router.location}
        project={TestStubs.Project()}
      />
    );

    expect(wrapper.find('SectionHeading').text()).toBe('Quick Links');
    expect(wrapper.find('QuickLink a').length).toBe(2);

    const userFeedback = wrapper.find('QuickLink').at(0);
    const mostChangedTransactions = wrapper.find('QuickLink').at(1);

    expect(userFeedback.text()).toBe('User Feedback');
    expect(userFeedback.prop('to')).toEqual({
      pathname: '/organizations/org-slug/user-feedback/',
      query: {project: '2'},
    });

    expect(mostChangedTransactions.text()).toBe('Most Improved/Regressed Transactions');
    expect(mostChangedTransactions.prop('to')).toEqual({
      pathname: '/organizations/org-slug/performance/',
      query: {
        cursor: undefined,
        project: '2',
        query: 'tpm():>0.01 transaction.duration:>0 transaction.duration:<15min',
        view: 'TRENDS',
      },
    });
  });

  it('disables link if feature is missing', function () {
    const wrapper = mountWithTheme(
      <ProjectQuickLinks
        organization={{...organization, features: []}}
        location={router.location}
        project={TestStubs.Project()}
      />
    );

    const mostChangedTransactions = wrapper.find('QuickLink').at(1);
    const tooltip = wrapper.find('Tooltip').at(1);

    expect(mostChangedTransactions.prop('disabled')).toBeTruthy();
    expect(mostChangedTransactions.find('a').exists()).toBeFalsy();
    expect(tooltip.prop('title')).toBe("You don't have access to this feature");
    expect(tooltip.prop('disabled')).toBeFalsy();
  });
});
