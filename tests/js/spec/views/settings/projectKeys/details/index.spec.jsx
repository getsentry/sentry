import PropTypes from 'prop-types';

import {mountWithTheme} from 'sentry-test/enzyme';
import {mountGlobalModal} from 'sentry-test/modal';

import ProjectKeyDetails from 'sentry/views/settings/project/projectKeys/details';

describe('ProjectKeyDetails', function () {
  let org;
  let project;
  let wrapper;
  let deleteMock;
  let statsMock;
  let putMock;
  let projectKeys;

  beforeEach(function () {
    org = TestStubs.Organization();
    project = TestStubs.Project();
    projectKeys = TestStubs.ProjectKeys();

    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/keys/${projectKeys[0].id}/`,
      method: 'GET',
      body: projectKeys[0],
    });
    putMock = MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/keys/${projectKeys[0].id}/`,
      method: 'PUT',
    });
    statsMock = MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/keys/${projectKeys[0].id}/stats/`,
      method: 'GET',
      body: [
        {filtered: 0, accepted: 0, total: 0, ts: 1517270400, dropped: 0},
        {filtered: 0, accepted: 0, total: 0, ts: 1517356800, dropped: 0},
        {filtered: 0, accepted: 0, total: 0, ts: 1517443200, dropped: 0},
        {filtered: 0, accepted: 0, total: 0, ts: 1517529600, dropped: 0},
        {filtered: 0, accepted: 0, total: 0, ts: 1517616000, dropped: 0},
        {filtered: 0, accepted: 0, total: 0, ts: 1517702400, dropped: 0},
        {filtered: 0, accepted: 0, total: 0, ts: 1517788800, dropped: 0},
        {filtered: 0, accepted: 0, total: 0, ts: 1517875200, dropped: 0},
        {filtered: 0, accepted: 0, total: 0, ts: 1517961600, dropped: 0},
        {filtered: 0, accepted: 0, total: 0, ts: 1518048000, dropped: 0},
        {filtered: 0, accepted: 0, total: 0, ts: 1518134400, dropped: 0},
        {filtered: 0, accepted: 0, total: 0, ts: 1518220800, dropped: 0},
        {filtered: 0, accepted: 0, total: 0, ts: 1518307200, dropped: 0},
        {filtered: 0, accepted: 0, total: 0, ts: 1518393600, dropped: 0},
        {filtered: 0, accepted: 0, total: 0, ts: 1518480000, dropped: 0},
        {filtered: 0, accepted: 0, total: 0, ts: 1518566400, dropped: 0},
        {filtered: 0, accepted: 0, total: 0, ts: 1518652800, dropped: 0},
        {filtered: 0, accepted: 0, total: 0, ts: 1518739200, dropped: 0},
        {filtered: 0, accepted: 0, total: 0, ts: 1518825600, dropped: 0},
        {filtered: 0, accepted: 0, total: 0, ts: 1518912000, dropped: 0},
        {filtered: 0, accepted: 0, total: 0, ts: 1518998400, dropped: 0},
        {filtered: 0, accepted: 0, total: 0, ts: 1519084800, dropped: 0},
        {filtered: 0, accepted: 0, total: 0, ts: 1519171200, dropped: 0},
        {filtered: 0, accepted: 0, total: 0, ts: 1519257600, dropped: 0},
        {filtered: 0, accepted: 0, total: 0, ts: 1519344000, dropped: 0},
        {filtered: 0, accepted: 0, total: 0, ts: 1519430400, dropped: 0},
        {filtered: 0, accepted: 0, total: 0, ts: 1519516800, dropped: 0},
        {filtered: 0, accepted: 0, total: 0, ts: 1519603200, dropped: 0},
        {filtered: 0, accepted: 0, total: 0, ts: 1519689600, dropped: 0},
        {filtered: 0, accepted: 5, total: 12, ts: 1519776000, dropped: 7},
        {filtered: 0, accepted: 14, total: 14, ts: 1519862400, dropped: 0},
      ],
    });
    deleteMock = MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/keys/${projectKeys[0].id}/`,
      method: 'DELETE',
    });

    wrapper = mountWithTheme(
      <ProjectKeyDetails
        routes={[]}
        params={{
          keyId: projectKeys[0].id,
          orgId: org.slug,
          projectId: project.slug,
        }}
      />,
      {
        context: {
          project: TestStubs.Project(),
        },
        childContextTypes: {
          project: PropTypes.object,
        },
      }
    );
  });

  it('has stats box', function () {
    expect(wrapper.find('KeyStats')).toHaveLength(1);
    expect(statsMock).toHaveBeenCalled();
  });

  it('changes name', function () {
    wrapper
      .find('input[name="name"]')
      .simulate('change', {target: {value: 'New Name'}})
      .simulate('blur');

    expect(putMock).toHaveBeenCalledWith(
      `/projects/${org.slug}/${project.slug}/keys/${projectKeys[0].id}/`,
      expect.objectContaining({
        data: {
          name: 'New Name',
        },
      })
    );
  });

  it('disable and enables key', function () {
    wrapper.find('Switch[name="isActive"]').simulate('click');

    expect(putMock).toHaveBeenCalledWith(
      `/projects/${org.slug}/${project.slug}/keys/${projectKeys[0].id}/`,
      expect.objectContaining({
        data: {isActive: false},
      })
    );

    wrapper.find('Switch[name="isActive"]').simulate('click');

    expect(putMock).toHaveBeenCalledWith(
      `/projects/${org.slug}/${project.slug}/keys/${projectKeys[0].id}/`,
      expect.objectContaining({
        data: {isActive: false},
      })
    );
  });

  it('revokes a key', async function () {
    wrapper
      .find('Button[priority="danger"]')
      .simulate('click', {preventDefault: () => {}});

    const modal = await mountGlobalModal();
    modal.find('Button[priority="danger"]').simulate('click');

    expect(deleteMock).toHaveBeenCalled();
  });
});
