import {GitHubIntegrationProviderFixture} from 'sentry-fixture/githubIntegrationProvider';

import {render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';

import * as pipelineModal from 'sentry/components/pipeline/modal';
import {ConnectProviderDropdown} from 'sentry/views/settings/organizationRepositories/connectProviderDropdown';

const githubProvider = GitHubIntegrationProviderFixture();
const gitlabProvider = GitHubIntegrationProviderFixture({
  key: 'gitlab',
  slug: 'gitlab',
  name: 'GitLab',
});
const bitbucketProvider = GitHubIntegrationProviderFixture({
  key: 'bitbucket',
  slug: 'bitbucket',
  name: 'Bitbucket',
});

describe('ConnectProviderDropdown', () => {
  it('lists every provider in the menu', async () => {
    render(
      <ConnectProviderDropdown
        providers={[githubProvider, gitlabProvider, bitbucketProvider]}
        onAddIntegration={jest.fn()}
      />
    );

    await userEvent.click(screen.getByRole('button', {name: 'Connect new provider'}));

    expect(screen.getByRole('menuitemradio', {name: 'GitHub'})).toBeInTheDocument();
    expect(screen.getByRole('menuitemradio', {name: 'GitLab'})).toBeInTheDocument();
    expect(screen.getByRole('menuitemradio', {name: 'Bitbucket'})).toBeInTheDocument();
  });

  it('marks Seer-compatible providers with an additional icon', async () => {
    render(
      <ConnectProviderDropdown
        providers={[githubProvider, bitbucketProvider]}
        onAddIntegration={jest.fn()}
      />
    );

    await userEvent.click(screen.getByRole('button', {name: 'Connect new provider'}));

    const githubItem = screen.getByRole('menuitemradio', {name: 'GitHub'});
    const bitbucketItem = screen.getByRole('menuitemradio', {name: 'Bitbucket'});

    expect(within(githubItem).getAllByRole('img')).toHaveLength(2);
    expect(within(bitbucketItem).getAllByRole('img')).toHaveLength(1);
  });

  it('shows the Seer footer when at least one provider is Seer-compatible', async () => {
    render(
      <ConnectProviderDropdown
        providers={[githubProvider, bitbucketProvider]}
        onAddIntegration={jest.fn()}
      />
    );

    await userEvent.click(screen.getByRole('button', {name: 'Connect new provider'}));

    expect(screen.getByText(/Compatible with/)).toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'Seer'})).toHaveAttribute(
      'href',
      'https://docs.sentry.io/product/ai-in-sentry/seer/'
    );
  });

  it('hides the Seer footer when no provider is Seer-compatible', async () => {
    render(
      <ConnectProviderDropdown
        providers={[bitbucketProvider]}
        onAddIntegration={jest.fn()}
      />
    );

    await userEvent.click(screen.getByRole('button', {name: 'Connect new provider'}));

    expect(screen.queryByText(/Compatible with/)).not.toBeInTheDocument();
  });

  it('disables providers that cannot be added', async () => {
    render(
      <ConnectProviderDropdown
        providers={[GitHubIntegrationProviderFixture({canAdd: false})]}
        onAddIntegration={jest.fn()}
      />
    );

    await userEvent.click(screen.getByRole('button', {name: 'Connect new provider'}));

    expect(screen.getByRole('menuitemradio', {name: 'GitHub'})).toHaveAttribute(
      'aria-disabled',
      'true'
    );
  });

  it('starts the install flow when a provider is selected', async () => {
    const openPipelineModalSpy = jest.spyOn(pipelineModal, 'openPipelineModal');

    render(
      <ConnectProviderDropdown
        providers={[githubProvider]}
        onAddIntegration={jest.fn()}
      />
    );

    await userEvent.click(screen.getByRole('button', {name: 'Connect new provider'}));
    await userEvent.click(screen.getByRole('menuitemradio', {name: 'GitHub'}));

    expect(openPipelineModalSpy).toHaveBeenCalledWith(
      expect.objectContaining({type: 'integration', provider: 'github'})
    );
  });
});
