import PropTypes from 'prop-types';

import {mountWithTheme} from 'sentry-test/enzyme';
import {mountGlobalModal} from 'sentry-test/modal';

import ProjectKeys from 'sentry/views/settings/project/projectKeys/list';

describe('ProjectKeys', function () {
  let org, project, wrapper;
  let deleteMock;
  let projectKeys;

  beforeEach(function () {
    org = TestStubs.Organization();
    project = TestStubs.Project();
    projectKeys = TestStubs.ProjectKeys();

    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/keys/`,
      method: 'GET',
      body: projectKeys,
    });
    deleteMock = MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/keys/${projectKeys[0].id}/`,
      method: 'DELETE',
    });

    wrapper = mountWithTheme(
      <ProjectKeys routes={[]} params={{orgId: org.slug, projectId: project.slug}} />,
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

  it('renders empty', function () {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/keys/`,
      method: 'GET',
      body: [],
    });

    wrapper = mountWithTheme(
      <ProjectKeys routes={[]} params={{orgId: org.slug, projectId: project.slug}} />
    );

    expect(wrapper.find('EmptyMessage')).toHaveLength(1);
  });

  it('has clippable box', function () {
    const clipFade = wrapper.find('ClipFade');
    expect(clipFade).toHaveLength(1);
    const clipFadeButton = clipFade.find('button');
    expect(clipFadeButton).toHaveLength(1);
    clipFadeButton.simulate('click');
    expect(wrapper.find('ClipFade button')).toHaveLength(0);
  });

  it('deletes key', async function () {
    wrapper.find('PanelHeader Button').last().simulate('click');

    // Confirm modal
    const modal = await mountGlobalModal();
    modal.find('Button[priority="danger"]').simulate('click');

    expect(deleteMock).toHaveBeenCalled();
  });

  it('disable and enables key', function () {
    const enableMock = MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/keys/${projectKeys[0].id}/`,
      method: 'PUT',
    });

    wrapper.find('PanelHeader Button').at(1).simulate('click');

    expect(enableMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        data: {isActive: false},
      })
    );

    wrapper.find('PanelHeader Button').at(1).simulate('click');

    expect(enableMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        data: {isActive: true},
      })
    );
  });
});
