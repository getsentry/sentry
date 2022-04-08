import {mountWithTheme} from 'sentry-test/enzyme';

import {openCreateTeamModal} from 'sentry/actionCreators/modal';
import {CreateProject} from 'sentry/views/projectInstall/createProject';

jest.mock('sentry/actionCreators/modal');

describe('CreateProject', function () {
  const teamNoAccess = {slug: 'test', id: '1', name: 'test', hasAccess: false};
  const teamWithAccess = {...teamNoAccess, hasAccess: true};

  const baseProps = {
    api: new MockApiClient(),
    location: {query: {}},
    organization: TestStubs.Organization(),
    teams: [teamNoAccess],
    params: {
      projectId: '',
      orgId: 'testOrg',
    },
  };

  it('should block if you have access to no teams', function () {
    const props = {
      ...baseProps,
    };

    const wrapper = mountWithTheme(
      <CreateProject {...props} />,
      TestStubs.routerContext([{organization: {id: '1', slug: 'testOrg'}}])
    );

    expect(wrapper).toSnapshot();
  });

  it('can create a new team', function () {
    const props = {
      ...baseProps,
    };

    const wrapper = mountWithTheme(
      <CreateProject {...props} />,
      TestStubs.routerContext([{organization: {id: '1', slug: 'testOrg'}}])
    );

    wrapper.find('TeamSelectInput Button button').simulate('click');
    expect(openCreateTeamModal).toHaveBeenCalled();
  });

  it('should fill in project name if its empty when platform is chosen', function () {
    const props = {
      ...baseProps,
    };

    const wrapper = mountWithTheme(
      <CreateProject {...props} teams={[teamWithAccess]} />,
      TestStubs.routerContext([
        {organization: {id: '1', slug: 'testOrg'}, location: {query: {}}},
      ])
    );

    let node = wrapper.find('PlatformCard').first();
    node.simulate('click');
    expect(wrapper.find('ProjectNameInput input').props().value).toBe('iOS');

    node = wrapper.find('PlatformCard').last();
    node.simulate('click');
    expect(wrapper.find('ProjectNameInput input').props().value).toBe('Rails');

    // but not replace it when project name is something else:
    wrapper.setState({projectName: 'another'});

    node = wrapper.find('PlatformCard').first();
    node.simulate('click');
    expect(wrapper.find('ProjectNameInput input').props().value).toBe('another');

    expect(wrapper).toSnapshot();
  });

  it('should fill in platform name if its provided by url', function () {
    const props = {
      ...baseProps,
      location: {query: {platform: 'ruby-rails'}},
    };

    const wrapper = mountWithTheme(
      <CreateProject {...props} teams={[teamWithAccess]} />,
      TestStubs.routerContext([{organization: {id: '1', slug: 'testOrg'}}])
    );

    expect(wrapper.find('ProjectNameInput input').props().value).toBe('Rails');

    expect(wrapper).toSnapshot();
  });

  it('should fill in category name if its provided by url', function () {
    const props = {
      ...baseProps,
      location: {query: {category: 'mobile'}},
    };

    const wrapper = mountWithTheme(
      <CreateProject {...props} teams={[teamWithAccess]} />,
      TestStubs.routerContext([{organization: {id: '1', slug: 'testOrg'}}])
    );

    expect(wrapper.find('PlatformPicker').state('category')).toBe('mobile');
  });

  it('should deal with incorrect platform name if its provided by url', function () {
    const props = {
      ...baseProps,
    };

    const wrapper = mountWithTheme(
      <CreateProject {...props} teams={[teamWithAccess]} />,
      TestStubs.routerContext([
        {
          organization: {id: '1', slug: 'testOrg'},
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
      props.teams = [teamWithAccess];
      MockApiClient.addMockResponse({
        url: `/projects/${props.organization.slug}/rule-conditions/`,
        body: TestStubs.MOCK_RESP_VERBOSE,
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
        .find('Radio input')
        .simulate('change');
      expectSubmitButtonToBeDisabled(true);

      wrapper
        .find('input[data-test-id="range-input"]')
        .first()
        .simulate('change', {target: {value: '2'}});
      expectSubmitButtonToBeDisabled(true);

      wrapper.find('PlatformCard').first().simulate('click');
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

      wrapper.find('Radio input').first().simulate('change');
      expectSubmitButtonToBeDisabled(false);
    });
  });
});
