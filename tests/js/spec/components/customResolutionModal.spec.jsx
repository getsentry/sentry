import selectEvent from 'react-select-event';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import CustomResolutionModal from 'sentry/components/customResolutionModal';

describe('CustomResolutionModal', () => {
  let releasesMock;
  beforeEach(() => {
    releasesMock = MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/releases/',
      body: [TestStubs.Release()],
    });
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
    userEvent.click(screen.getByText('1.2.0'));

    userEvent.click(screen.getByText('Save Changes'));
    expect(onSelected).toHaveBeenCalledWith({
      inRelease: 'sentry-android-shop@1.2.0',
    });
  });
});
