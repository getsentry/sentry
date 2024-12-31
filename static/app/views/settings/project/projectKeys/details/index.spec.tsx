import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {ProjectKeysFixture} from 'sentry-fixture/projectKeys';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
} from 'sentry-test/reactTestingLibrary';

import type {Organization} from 'sentry/types/organization';
import type {Project, ProjectKey} from 'sentry/types/project';
import ProjectKeyDetails from 'sentry/views/settings/project/projectKeys/details';

describe('ProjectKeyDetails', function () {
  const {routerProps} = initializeOrg();

  let org: Organization;
  let project: Project;
  let deleteMock: jest.Mock;
  let statsMock: jest.Mock;
  let putMock: jest.Mock;
  let projectKeys: ProjectKey[];

  function renderProjectKeyDetails() {
    render(
      <ProjectKeyDetails
        {...routerProps}
        organization={org}
        project={project}
        params={{
          keyId: projectKeys[0].id,
          projectId: project.slug,
        }}
      />
    );
  }

  beforeEach(function () {
    org = OrganizationFixture();
    project = ProjectFixture();
    projectKeys = ProjectKeysFixture();

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
  });

  it('has stats box', async function () {
    renderProjectKeyDetails();
    expect(await screen.findByText('Key Details')).toBeInTheDocument();
    expect(statsMock).toHaveBeenCalled();
  });

  it('changes name', async function () {
    renderProjectKeyDetails();
    await userEvent.clear(await screen.findByRole('textbox', {name: 'Name'}));
    await userEvent.type(await screen.findByRole('textbox', {name: 'Name'}), 'New Name');
    await userEvent.tab();

    expect(putMock).toHaveBeenCalledWith(
      `/projects/${org.slug}/${project.slug}/keys/${projectKeys[0].id}/`,
      expect.objectContaining({
        data: {
          name: 'New Name',
        },
      })
    );
  });

  it('disable and enables key', async function () {
    renderProjectKeyDetails();
    await userEvent.click(await screen.findByRole('checkbox', {name: 'Enabled'}));

    expect(putMock).toHaveBeenCalledWith(
      `/projects/${org.slug}/${project.slug}/keys/${projectKeys[0].id}/`,
      expect.objectContaining({
        data: {isActive: false},
      })
    );

    await userEvent.click(await screen.findByRole('checkbox', {name: 'Enabled'}));

    expect(putMock).toHaveBeenCalledWith(
      `/projects/${org.slug}/${project.slug}/keys/${projectKeys[0].id}/`,
      expect.objectContaining({
        data: {isActive: false},
      })
    );
  });

  it('revokes a key', async function () {
    renderProjectKeyDetails();
    await userEvent.click(await screen.findByRole('button', {name: 'Revoke Key'}));
    renderGlobalModal();
    await userEvent.click(await screen.findByTestId('confirm-button'));
    expect(deleteMock).toHaveBeenCalled();
  });
});
