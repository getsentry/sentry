import {mountWithTheme} from 'sentry-test/enzyme';
import {initializeOrg} from 'sentry-test/initializeOrg';

import ProjectDebugFiles from 'app/views/settings/projectDebugFiles';

describe('ProjectDebugFiles', function () {
  const {organization, project, routerContext} = initializeOrg({});

  const props = {
    organization,
    params: {orgId: organization.slug, projectId: project.slug},
    location: {
      query: {
        query: '',
      },
    },
  };

  const endpoint = `/projects/${organization.slug}/${project.slug}/files/dsyms/`;

  it('renders', function () {
    MockApiClient.addMockResponse({
      url: endpoint,
      body: [TestStubs.DebugFile()],
    });

    const wrapper = mountWithTheme(<ProjectDebugFiles {...props} />, routerContext);

    const items = wrapper.find('DebugFileRow');

    expect(items).toHaveLength(1);
    expect(items.at(0).find('Name').text()).toBe('libS.so');
  });

  it('renders empty', function () {
    MockApiClient.addMockResponse({
      url: endpoint,
      body: [],
    });

    const wrapper = mountWithTheme(<ProjectDebugFiles {...props} />, routerContext);

    expect(wrapper.find('EmptyStateWarning').text()).toBe(
      'There are no debug symbols for this project.'
    );
  });

  it('deletes the file', function () {
    MockApiClient.addMockResponse({
      url: endpoint,
      body: [TestStubs.DebugFile()],
    });

    const deleteMock = MockApiClient.addMockResponse({
      method: 'DELETE',
      url: `/projects/${organization.slug}/${project.slug}/files/dsyms/?id=${
        TestStubs.DebugFile().id
      }`,
    });

    const wrapper = mountWithTheme(<ProjectDebugFiles {...props} />, routerContext);

    wrapper.find('Button[data-test-id="delete-dif"]').simulate('click');

    // Confirm Modal
    wrapper.find('Modal Button[data-test-id="confirm-button"]').simulate('click');

    expect(deleteMock).toHaveBeenCalled();
  });
});
