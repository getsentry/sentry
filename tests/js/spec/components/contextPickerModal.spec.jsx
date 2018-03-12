import React from 'react';

import * as OrgActions from 'app/actionCreators/organizations';
import {mount, shallow} from 'enzyme';
import {ContextPickerModal} from 'app/components/contextPickerModal';

jest.mock('jquery');

describe('ContextPickerModal', function() {
  let project, project2, org, org2;
  let onFinish = jest.fn();

  beforeEach(function() {
    MockApiClient.clearMockResponses();
    onFinish.mockReset();

    project = TestStubs.Project();
    org = TestStubs.Organization({projects: [project]});
    project2 = TestStubs.Project({slug: 'project2'});
    org2 = TestStubs.Organization({
      slug: 'org2',
      id: '21',
    });
  });

  const getComponent = props => (
    <ContextPickerModal
      Header={() => <div />}
      Body="div"
      nextPath="/test/:orgId/path/"
      organizations={[org, org2]}
      needOrg
      latestContext={{}}
      onFinish={onFinish}
      {...props}
    />
  );

  it('renders with only org selector when no org in latest context', function() {
    let wrapper = shallow(getComponent());

    expect(wrapper.find('Select2Field[name="organization"]').exists()).toBe(true);
    expect(wrapper.find('Select2Field[name="project"]').exists()).toBe(false);
  });

  it('fetches org details and sets as active org if there is only one org', function() {
    let spy = jest.spyOn(OrgActions, 'fetchOrganizationDetails');
    let api = MockApiClient.addMockResponse({
      url: `/organizations/${org2.slug}/`,
    });
    let wrapper = mount(getComponent({organizations: [org2]}));

    wrapper.update();
    expect(spy).toHaveBeenCalledWith('org2', {
      setActive: true,
      loadProjects: true,
    });
    expect(api).toHaveBeenCalled();
  });

  it('calls onFinish after latestContext is set, if project id is not needed, and only 1 org', function() {
    let spy = jest.spyOn(OrgActions, 'fetchOrganizationDetails');
    let api = MockApiClient.addMockResponse({
      url: `/organizations/${org2.slug}/`,
    });
    let wrapper = mount(getComponent({organizations: [org2]}));

    expect(spy).toHaveBeenCalledWith('org2', {
      setActive: true,
      loadProjects: true,
    });
    expect(api).toHaveBeenCalled();

    wrapper.setProps({latestContext: {organization: org2}});
    wrapper.update();
    expect(onFinish).toHaveBeenCalledWith('/test/org2/path/');
  });

  it('calls onFinish if there is only 1 org and 1 project', function() {
    let spy = jest.spyOn(OrgActions, 'fetchOrganizationDetails');
    let api = MockApiClient.addMockResponse({
      url: `/organizations/${org2.slug}/`,
    });
    let wrapper = mount(
      getComponent({
        needOrg: true,
        needProject: true,
        nextPath: '/test/:orgId/path/:projectId/',
        organizations: [org2],
      })
    );

    expect(spy).toHaveBeenCalledWith('org2', {
      setActive: true,
      loadProjects: true,
    });
    expect(api).toHaveBeenCalled();

    wrapper.setProps({latestContext: {organization: {...org2, projects: [project2]}}});
    wrapper.update();
    expect(onFinish).toHaveBeenCalledWith('/test/org2/path/project2/');
  });

  it('selects an org and calls `onFinish` with URL with organization slug', function() {
    let wrapper = mount(getComponent({}));
    let mock = MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/`,
    });

    wrapper
      .find('Select2Field[name="organization"]')
      .instance()
      .onChange({target: {value: org.slug}});
    expect(onFinish).toHaveBeenCalledWith('/test/org-slug/path/');
    // Is not called because we don't need to fetch org details
    expect(mock).not.toHaveBeenCalled();
  });

  it('renders with project selector and org selector selected when org is in latest context', function() {
    let wrapper = shallow(
      getComponent({
        needOrg: true,
        needProject: true,
        latestContext: {
          organization: {
            ...org,
            projects: [project, project2],
          },
        },
      })
    );

    // Default to org in latest context
    expect(wrapper.find('Select2Field[name="organization"]').prop('value')).toBe(
      org.slug
    );
    expect(wrapper.find('Select2Field[name="project"]').prop('choices')).toEqual([
      ['', ''],
      [project.slug, project.slug],
      [project2.slug, project2.slug],
    ]);
  });

  it('can select org and project', function() {
    let spy = jest.spyOn(OrgActions, 'fetchOrganizationDetails');
    let api = MockApiClient.addMockResponse({
      url: `/organizations/${org2.slug}/`,
    });
    let wrapper = mount(
      getComponent({
        needOrg: true,
        needProject: true,
        nextPath: '/test/:orgId/path/:projectId/',
        organizations: [
          {
            ...org,
            projects: [project],
          },
          {
            ...org2,
            projects: [project2],
          },
        ],
      })
    );

    // Should not have anything selected
    expect(wrapper.find('Select2Field[name="organization"]').prop('value')).toBe('');

    // Select org2
    wrapper
      .find('Select2Field[name="organization"]')
      .instance()
      .onChange({target: {value: org2.slug}});

    expect(spy).toHaveBeenCalledWith('org2', {
      setActive: true,
      loadProjects: true,
    });
    expect(api).toHaveBeenCalled();

    // org2 should have 2 projects, project2 and project3
    wrapper.setProps({
      latestContext: {organization: {...org2, projects: [project2, {slug: 'project3'}]}},
    });
    wrapper.update();

    expect(wrapper.find('Select2Field[name="project"]').prop('choices')).toEqual([
      ['', ''],
      [project2.slug, project2.slug],
      ['project3', 'project3'],
    ]);

    // Select org3
    wrapper
      .find('Select2Field[name="project"]')
      .instance()
      .onChange({target: {value: 'project3'}});

    expect(onFinish).toHaveBeenCalledWith('/test/org2/path/project3/');
  });
});
