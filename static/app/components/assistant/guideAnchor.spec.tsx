import {ConfigFixture} from 'sentry-fixture/config';
import {UserFixture} from 'sentry-fixture/user';

import {act, render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import GuideAnchor from 'sentry/components/assistant/guideAnchor';
import ConfigStore from 'sentry/stores/configStore';
import GuideStore from 'sentry/stores/guideStore';

describe('GuideAnchor', function () {
  const serverGuide = [
    {
      guide: 'issue',
      seen: false,
    },
  ];
  const firstGuideHeader = 'How bad is it?';

  beforeEach(function () {
    ConfigStore.loadInitialData(
      ConfigFixture({
        user: UserFixture({
          isSuperuser: false,
          dateJoined: '2020-01-01T00:00:00',
        }),
      })
    );
  });

  it('renders, async advances, async and finishes', async function () {
    render(
      <div>
        <GuideAnchor target="issue_header_stats" />
        <GuideAnchor target="breadcrumbs" />
        <GuideAnchor target="issue_sidebar_owners" />
      </div>
    );

    act(() => GuideStore.fetchSucceeded(serverGuide));
    expect(await screen.findByText(firstGuideHeader)).toBeInTheDocument();

    // XXX(epurkhiser): Skip pointer event checks due to a bug with how Popper
    // renders the hovercard with pointer-events: none. See [0]
    //
    // [0]: https://github.com/testing-library/user-event/issues/639
    //
    // NOTE(epurkhiser): We may be able to remove the skipPointerEventsCheck
    // when we're on popper >= 1.
    await userEvent.click(screen.getByLabelText('Next'));

    expect(await screen.findByText('Retrace Your Steps')).toBeInTheDocument();
    expect(screen.queryByText(firstGuideHeader)).not.toBeInTheDocument();

    await userEvent.click(screen.getByLabelText('Next'));

    // Clicking on the button in the last step should finish the guide.
    const finishMock = MockApiClient.addMockResponse({
      method: 'PUT',
      url: '/assistant/',
    });

    await userEvent.click(screen.getByLabelText('Enough Already'));

    expect(finishMock).toHaveBeenCalledWith(
      '/assistant/',
      expect.objectContaining({
        method: 'PUT',
        data: {
          guide: 'issue',
          status: 'viewed',
        },
      })
    );
  });

  it('dismisses', async function () {
    render(
      <div>
        <GuideAnchor target="issue_header_stats" />
        <GuideAnchor target="breadcrumbs" />
        <GuideAnchor target="issue_sidebar_owners" />
      </div>
    );

    act(() => GuideStore.fetchSucceeded(serverGuide));
    expect(await screen.findByText(firstGuideHeader)).toBeInTheDocument();

    const dismissMock = MockApiClient.addMockResponse({
      method: 'PUT',
      url: '/assistant/',
    });

    await userEvent.click(screen.getByRole('button', {name: 'Close'}));

    expect(dismissMock).toHaveBeenCalledWith(
      '/assistant/',
      expect.objectContaining({
        method: 'PUT',
        data: {
          guide: 'issue',
          status: 'dismissed',
        },
      })
    );

    expect(screen.queryByText(firstGuideHeader)).not.toBeInTheDocument();
  });

  it('renders no container when inactive', function () {
    render(
      <GuideAnchor target="target 1">
        <span data-test-id="child-div" />
      </GuideAnchor>
    );

    expect(screen.queryByTestId('guide-container')).not.toBeInTheDocument();
    expect(screen.getByTestId('child-div')).toBeInTheDocument();
  });

  it('renders children when disabled', function () {
    render(
      <GuideAnchor disabled target="exception">
        <div data-test-id="child-div" />
      </GuideAnchor>
    );

    expect(screen.queryByTestId('guide-container')).not.toBeInTheDocument();
    expect(screen.getByTestId('child-div')).toBeInTheDocument();
  });

  it('if forceHide is true, async do not render guide', async function () {
    render(
      <div>
        <GuideAnchor target="issue_header_stats" />
        <GuideAnchor target="breadcrumbs" />
        <GuideAnchor target="issue_sidebar_owners" />
      </div>
    );

    act(() => GuideStore.fetchSucceeded(serverGuide));
    expect(await screen.findByText(firstGuideHeader)).toBeInTheDocument();
    act(() => GuideStore.setForceHide(true));
    expect(screen.queryByText(firstGuideHeader)).not.toBeInTheDocument();
    act(() => GuideStore.setForceHide(false));
    expect(await screen.findByText(firstGuideHeader)).toBeInTheDocument();
  });
});
