import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';
import {MOCK_RESP_VERBOSE} from 'sentry-test/fixtures/ruleConditions';

import {CreateProject} from 'app/views/projectInstall/createProject';
import {openCreateTeamModal} from 'app/actionCreators/modal';

jest.mock('app/actionCreators/modal');

describe('CreateProject', function() {
  const baseProps = {
    api: new MockApiClient(),
    location: {query: {}},
    organization: TestStubs.Organization(),
    teams: [],
    params: {
      projectId: '',
      orgId: 'testOrg',
    },
  };

  it('should block if you have access to no teams', function() {
    const props = {
      ...baseProps,
    };

    const wrapper = mountWithTheme(
      <CreateProject {...props} />,
      TestStubs.routerContext([
        {
          organization: {
            id: '1',
            slug: 'testOrg',
            teams: [{slug: 'test', id: '1', name: 'test', hasAccess: false}],
          },
          location: {query: {}},
        },
      ])
    );

    expect(wrapper).toSnapshot();
  });

  it('can create a new team', function() {
    const props = {
      ...baseProps,
    };

    const wrapper = mountWithTheme(
      <CreateProject {...props} />,
      TestStubs.routerContext([
        {
          organization: {
            id: '1',
            slug: 'testOrg',
            teams: [{slug: 'test', id: '1', name: 'test', hasAccess: false}],
          },
        },
      ])
    );

    wrapper.find('TeamSelectInput Button').simulate('click');
    expect(openCreateTeamModal).toHaveBeenCalled();
  });

  it('should fill in project name if its empty when platform is chosen', function() {
    const props = {
      ...baseProps,
    };

    const wrapper = mountWithTheme(
      <CreateProject {...props} />,
      TestStubs.routerContext([
        {
          organization: {
            id: '1',
            slug: 'testOrg',
            teams: [{slug: 'test', id: '1', name: 'test', hasAccess: true}],
          },
          location: {query: {}},
        },
      ])
    );

    let node = wrapper.find('PlatformCard').first();
    node.simulate('click');
    expect(wrapper.find('ProjectNameInput input').props().value).toBe('C#');

    node = wrapper.find('PlatformCard').last();
    node.simulate('click');
    expect(wrapper.find('ProjectNameInput input').props().value).toBe('Rails');

    //but not replace it when project name is something else:
    wrapper.setState({projectName: 'another'});

    node = wrapper.find('PlatformCard').first();
    node.simulate('click');
    expect(wrapper.find('ProjectNameInput input').props().value).toBe('another');

    expect(wrapper).toSnapshot();
  });

  it('should fill in platform name if its provided by url', function() {
    const props = {
      ...baseProps,
    };

    const wrapper = mountWithTheme(
      <CreateProject {...props} />,
      TestStubs.routerContext([
        {
          organization: {
            id: '1',
            slug: 'testOrg',
            teams: [{slug: 'test', id: '1', name: 'test', hasAccess: true}],
          },
          location: {query: {platform: 'ruby-rails'}},
        },
      ])
    );

    expect(wrapper.find('ProjectNameInput input').props().value).toBe('Rails');

    expect(wrapper).toSnapshot();
  });

  it('should deal with incorrect platform name if its provided by url', function() {
    const props = {
      ...baseProps,
    };

    const wrapper = mountWithTheme(
      <CreateProject {...props} />,
      TestStubs.routerContext([
        {
          organization: {
            id: '1',
            slug: 'testOrg',
            teams: [{slug: 'test', id: '1', name: 'test', hasAccess: true}],
          },
          location: {query: {platform: 'XrubyROOLs'}},
        },
      ])
    );

    expect(wrapper.find('ProjectNameInput input').props().value).toBe('');

    expect(wrapper).toSnapshot();
  });

  describe('Issue Alerts Options', () => {
    let props = {};
    beforeEach(() => {
      props = {
        ...baseProps,
      };
      props.organization.teams = [{slug: 'test', id: '1', name: 'test', hasAccess: true}];
      MockApiClient.addMockResponse({
        url: `/projects/${props.organization.slug}/rule-conditions/`,
        body: MOCK_RESP_VERBOSE,
      });
    });

    afterEach(() => {
      MockApiClient.clearMockResponses();
    });

    it('should enabled the submit button if and only if all the required information has been filled', () => {
      const wrapper = mountWithTheme(
        <CreateProject {...props} />,
        TestStubs.routerContext([
          {
            location: {query: {}},
          },
        ])
      );

      const expectSubmitButtonToBeDisabled = isDisabled => {
        expect(
          wrapper.find('Button[data-test-id="create-project"]').props().disabled
        ).toBe(isDisabled);
      };

      wrapper
        .find('SelectControl[data-test-id="metric-select-control"]')
        .closest('RadioLineItem')
        .find('Radio')
        .simulate('change');
      expectSubmitButtonToBeDisabled(true);

      wrapper
        .find('input[data-test-id="range-input"]')
        .first()
        .simulate('change', {target: {value: '2'}});
      expectSubmitButtonToBeDisabled(true);

      wrapper
        .find('PlatformCard')
        .first()
        .simulate('click');
      expectSubmitButtonToBeDisabled(false);

      wrapper
        .find('input[data-test-id="range-input"]')
        .first()
        .simulate('change', {target: {value: ''}});
      expectSubmitButtonToBeDisabled(true);

      wrapper
        .find('input[data-test-id="range-input"]')
        .first()
        .simulate('change', {target: {value: '2712'}});
      expectSubmitButtonToBeDisabled(false);

      wrapper
        .find('input[data-test-id="range-input"]')
        .first()
        .simulate('change', {target: {value: ''}});
      expectSubmitButtonToBeDisabled(true);

      wrapper
        .find('Radio')
        .first()
        .simulate('change');
      expectSubmitButtonToBeDisabled(false);
    });
  });
});
