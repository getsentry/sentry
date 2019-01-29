import React from 'react';
import {browserHistory} from 'react-router';
import {shallow} from 'enzyme';

import TagStore from 'app/stores/tagStore';
import GroupStore from 'app/stores/groupStore';
import {OrganizationStream} from 'app/views/organizationStream/overview';

const DEFAULT_LINKS_HEADER =
  '<http://127.0.0.1:8000/api/0/organizations/org-slug/issues/?cursor=1443575731:0:1>; rel="previous"; results="false"; cursor="1443575731:0:1", ' +
  '<http://127.0.0.1:8000/api/0/organizations/org-slug/issues/?cursor=1443575731:0:0>; rel="next"; results="true"; cursor="1443575731:0:0';

describe('OrganizationStream', function() {
  let sandbox;
  let wrapper;
  let props;

  let organization;
  let project;
  let group;
  let savedSearch;

  let fetchTagsRequest;

  beforeEach(function() {
    sandbox = sinon.sandbox.create();

    project = TestStubs.ProjectDetails({
      id: '3559',
      name: 'Foo Project',
      slug: 'project-slug',
      firstEvent: true,
    });
    organization = TestStubs.Organization({
      id: '1337',
      slug: 'org-slug',
      access: ['releases'],
      projects: [project],
    });
    savedSearch = {
      id: '789',
      query: 'is:unresolved',
      name: 'test',
      projectId: project.id,
    };

    group = TestStubs.Group({project});
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/',
      body: [group],
      headers: {
        Link: DEFAULT_LINKS_HEADER,
      },
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/searches/',
      body: [savedSearch],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/processingissues/',
      method: 'GET',
      body: [
        {
          project: 'test-project',
          numIssues: 1,
          hasIssues: true,
          lastSeen: '2019-01-16T15:39:11.081Z',
        },
      ],
    });
    fetchTagsRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/tags/',
      method: 'GET',
      body: TestStubs.Tags(),
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/users/',
      method: 'GET',
      body: [TestStubs.Member({projects: [project.slug]})],
    });

    sandbox.stub(browserHistory, 'push');
    TagStore.init();

    props = {
      selection: {
        projects: [parseInt(organization.projects[0].id, 10)],
        environments: [],
        datetime: {period: '14d'},
      },
      location: {query: {query: 'is:unresolved'}, search: 'query=is:unresolved'},
      params: {orgId: organization.slug},
      organization,
    };
  });

  afterEach(function() {
    sandbox.restore();
    MockApiClient.clearMockResponses();
  });

  describe('getEndpointParams', function() {
    beforeEach(function() {
      wrapper = shallow(<OrganizationStream {...props} />);
    });

    it('omits null values', function() {
      wrapper.setProps({
        selection: {
          projects: null,
          environments: null,
          datetime: {period: '14d'},
        },
      });
      let value = wrapper.instance().getEndpointParams();

      expect(value.project).toBeUndefined();
      expect(value.projects).toBeUndefined();
      expect(value.environment).toBeUndefined();
      expect(value.environments).toBeUndefined();
      expect(value.statsPeriod).toEqual('14d');
    });

    it('omits defaults', function() {
      wrapper.setProps({
        location: {
          query: {
            sort: 'date',
            groupStatsPeriod: '24h',
          },
        },
      });
      let value = wrapper.instance().getEndpointParams();

      expect(value.groupStatsPeriod).toBeUndefined();
      expect(value.sort).toBeUndefined();
    });

    it('uses saved search data', function() {
      wrapper.setState({savedSearch});
      let value = wrapper.instance().getEndpointParams();

      expect(value.query).toEqual(savedSearch.query);
      expect(value.project).toEqual([parseInt(savedSearch.projectId, 10)]);
    });
  });

  describe('componentDidMount', function() {
    beforeEach(function() {
      wrapper = shallow(<OrganizationStream {...props} />);
    });

    it('fetches tags and sets state', async function() {
      let instance = wrapper.instance();
      await instance.componentDidMount();

      expect(fetchTagsRequest).toHaveBeenCalled();
      expect(instance.state.tags.assigned).toBeTruthy();
    });

    it('fetches members and sets state', async function() {
      let instance = wrapper.instance();
      await instance.componentDidMount();
      await wrapper.update();

      let members = instance.state.memberList;
      // Spot check the resulting structure as we munge it a bit.
      expect(members).toBeTruthy();
      expect(members[project.slug]).toBeTruthy();
      expect(members[project.slug][0].email).toBeTruthy();
    });

    it('fetches groups when there is no searchid', async function() {
      await wrapper.instance().componentDidMount();
    });
  });

  describe('componentDidMount with a valid saved search', function() {
    beforeEach(function() {
      props.params.searchId = '789';
      wrapper = shallow(<OrganizationStream {...props} />);
    });

    it('fetches searches and sets the savedSearch', async function() {
      wrapper.setState({loading: false});
      let instance = wrapper.instance();
      await instance.componentDidMount();
      await wrapper.update();

      expect(instance.state.savedSearch).toBeTruthy();
    });

    it('uses the saved search query', async function() {
      let instance = wrapper.instance();
      await instance.componentDidMount();
      await wrapper.update();

      expect(instance.getQuery()).toEqual(savedSearch.query);
    });
  });

  describe('componentDidMount with an invalid saved search', function() {
    beforeEach(function() {
      props.params.searchId = '999';
      wrapper = shallow(<OrganizationStream {...props} />);
      wrapper.setState({loading: false});
    });

    it('resets the savedSearch state', async function() {
      let instance = wrapper.instance();
      await instance.componentDidMount();
      await wrapper.update();

      expect(instance.state.savedSearch).toBeNull();
    });
  });

  describe('processingIssues', function() {
    beforeEach(function() {
      wrapper = shallow(<OrganizationStream {...props} />);
    });

    it('fetches and displays processing issues', async function() {
      let instance = wrapper.instance();
      instance.componentDidMount();
      await wrapper.update();

      GroupStore.add([group]);
      wrapper.setState({
        groupIds: ['1'],
        loading: false,
      });

      let issues = wrapper.find('ProcessingIssueList');
      expect(issues).toHaveLength(1);
    });
  });

  describe('render states', function() {
    beforeEach(function() {
      wrapper = shallow(<OrganizationStream {...props} />);
    });

    it('displays the loading icon', function() {
      wrapper.setState({loading: true});
      expect(wrapper.find('LoadingIndicator')).toHaveLength(1);
    });

    it('displays an error', function() {
      wrapper.setState({error: 'Things broke', loading: false});

      let error = wrapper.find('LoadingError');
      expect(error).toHaveLength(1);
      expect(error.props().message).toEqual('Things broke');
    });

    it('displays an empty resultset', function() {
      wrapper.setState({
        loading: false,
        error: false,
        groupIds: [],
      });
      expect(wrapper.find('EmptyStateWarning')).toHaveLength(1);
    });

    it('displays the getting started state', function() {
      let proj = TestStubs.ProjectDetails({
        firstEvent: false,
      });
      let org = TestStubs.Organization({
        access: ['releases'],
        projects: [proj],
      });
      wrapper.setProps({
        organization: org,
        selection: {
          projects: [parseInt(proj.id, 10)],
          environments: [],
          datetime: {period: '14d'},
        },
      });
      wrapper.setState({loading: false});
      expect(wrapper.find('ErrorRobot')).toHaveLength(1);
    });

    it('displays group rows', function() {
      GroupStore.add([group]);
      wrapper.setState({
        error: false,
        loading: false,
        groupIds: ['1'],
      });
      let groups = wrapper.find('StreamGroup');
      expect(groups).toHaveLength(1);
    });
  });
});
