import selectEvent from 'react-select-event';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import CustomResolutionModal from 'sentry/components/customResolutionModal';
import ConfigStore from 'sentry/stores/configStore';

describe('CustomResolutionModal', () => {
  let releasesMock;
  beforeEach(() => {
    ConfigStore.init();
    releasesMock = MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/releases/',
      body: [TestStubs.Release({authors: [TestStubs.User()]})],
    });
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('can select a version', async () => {
    const onSelected = jest.fn();
    render(
      <CustomResolutionModal
        Header={p => p.children}
        Body={p => p.children}
        Footer={p => p.children}
        orgSlug="org-slug"
        projectSlug="project-slug"
        onSelected={onSelected}
        closeModal={jest.fn()}
      />
    );
    expect(releasesMock).toHaveBeenCalled();

    selectEvent.openMenu(screen.getByText('e.g. 1.0.4'));
    expect(await screen.findByText('1.2.0')).toBeInTheDocument();
    await userEvent.click(screen.getByText('1.2.0'));

    await userEvent.click(screen.getByText('Resolve'));
    expect(onSelected).toHaveBeenCalledWith({
      inRelease: 'sentry-android-shop@1.2.0',
    });
  });

  it('indicates which releases had commits from the user', async () => {
    const user = TestStubs.User();
    ConfigStore.set('user', user);
    render(
      <CustomResolutionModal
        Header={p => p.children}
        Body={p => p.children}
        Footer={p => p.children}
        orgSlug="org-slug"
        projectSlug="project-slug"
        closeModal={jest.fn()}
      />
    );
    expect(releasesMock).toHaveBeenCalled();

    selectEvent.openMenu(screen.getByText('e.g. 1.0.4'));
    expect(await screen.findByText(/You committed/)).toBeInTheDocument();
  });
});
