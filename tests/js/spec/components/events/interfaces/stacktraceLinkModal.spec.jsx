import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';

import StacktraceLinkModal from 'app/components/events/interfaces/stacktraceLinkModal';

describe('StacktraceLinkModal', function () {
  const org = TestStubs.Organization();
  const project = TestStubs.Project();
  const integration = TestStubs.GitHubIntegration();
  const filename = '/sentry/app.py';
  const repo = TestStubs.Repository({integrationId: integration.id});
  const config = TestStubs.RepositoryProjectPathConfig(project, repo, integration);

  const closeModal = jest.fn();
  const modalElements = {
    Header: p => p.children,
    Body: p => p.children,
    Footer: p => p.children,
  };

  beforeEach(function () {
    closeModal.mockReset();
    MockApiClient.clearMockResponses();
  });

  it('renders manual setup option', async function () {
    const wrapper = mountWithTheme(
      <StacktraceLinkModal
        {...modalElements}
        project={project}
        organization={org}
        integrations={[integration]}
        filename={filename}
        closeModal={closeModal}
      />,
      TestStubs.routerContext()
    );
    expect(wrapper.find('IntegrationName').text()).toEqual('Test Integration');
  });

  it('closes modal after successful quick setup', async function () {
    const configData = {
      stackRoot: '',
      sourceRoot: 'src/',
      integrationId: integration.id,
      repositoryId: repo.id,
      defaultBranch: 'master',
    };
    const sourceUrl = 'https://github.com/getsentry/sentry/blob/master/src/sentry/app.py';

    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/repo-path-parsing/`,
      method: 'POST',
      body: {...configData},
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/integrations/${integration.id}/repo-project-path-configs/`,
      method: 'POST',
    });

    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/stacktrace-link/`,
      query: {file: filename, commitId: 'master', platform: 'python'},
      body: {config, sourceUrl, integrations: [integration]},
    });

    const wrapper = mountWithTheme(
      <StacktraceLinkModal
        {...modalElements}
        project={project}
        organization={org}
        integrations={[integration]}
        filename={filename}
        closeModal={closeModal}
      />,
      TestStubs.routerContext()
    );
    wrapper.find('input').simulate('change', {target: {value: sourceUrl}});
    // submit quick setup input
    wrapper.find('Button[data-test-id="quick-setup-button"]').simulate('click');

    await tick();
    wrapper.update();

    expect(closeModal).toHaveBeenCalled();
  });

  it('keeps modal open on unsuccessful quick setup', async function () {
    const configData = {
      stackRoot: '',
      sourceRoot: 'src/',
      integrationId: integration.id,
      repositoryId: repo.id,
      defaultBranch: 'master',
    };
    const sourceUrl = 'https://github.com/getsentry/sentry/blob/master/src/sentry/app.py';

    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/repo-path-parsing/`,
      method: 'POST',
      body: {...configData},
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/integrations/${integration.id}/repo-project-path-configs/`,
      method: 'POST',
      statusCode: 400,
    });

    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/stacktrace-link/`,
      query: {file: filename, commitId: 'master', platform: 'python'},
      body: {config, sourceUrl, integrations: [integration]},
    });

    const wrapper = mountWithTheme(
      <StacktraceLinkModal
        {...modalElements}
        project={project}
        organization={org}
        integrations={[integration]}
        filename={filename}
        closeModal={closeModal}
      />,
      TestStubs.routerContext()
    );
    wrapper.find('input').simulate('change', {target: {value: sourceUrl}});
    // submit quick setup input
    wrapper.find('Button[data-test-id="quick-setup-button"]').simulate('click');

    await tick();
    wrapper.update();

    expect(closeModal).not.toHaveBeenCalled();
  });
});
