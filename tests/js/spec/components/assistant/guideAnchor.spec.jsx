import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

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

  beforeEach(function () {
    ConfigStore.config = {
      user: {
        isSuperuser: false,
        dateJoined: new Date(2020, 0, 1),
      },
    };
  });

  it('renders, advances, and finishes', async function () {
    render(
      <div>
        <GuideAnchor target="issue_number" />
        <GuideAnchor target="exception" />
      </div>
    );

    GuideStore.fetchSucceeded(serverGuide);
    expect(await screen.findByText('Identify Your Issues')).toBeInTheDocument();

    // XXX(epurkhiser): Skip pointer event checks due to a bug with how Popper
    // renders the hovercard with pointer-events: none. See [0]
    //
    // [0]: https://github.com/testing-library/user-event/issues/639
    //
    // NOTE(epurkhiser): We may be able to remove the skipPointerEventsCheck
    // when we're on popper >= 1.
    userEvent.click(screen.getByLabelText('Next'), undefined, {
      skipPointerEventsCheck: true,
    });

    expect(await screen.findByText('Narrow Down Suspects')).toBeInTheDocument();
    expect(screen.queryByText('Identify Your Issues')).not.toBeInTheDocument();

    // Clicking on the button in the last step should finish the guide.
    const finishMock = MockApiClient.addMockResponse({
      method: 'PUT',
      url: '/assistant/',
    });

    userEvent.click(screen.getByLabelText('Enough Already'), undefined, {
      skipPointerEventsCheck: true,
    });

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
        <GuideAnchor target="issue_number" />
        <GuideAnchor target="exception" />
      </div>
    );

    GuideStore.fetchSucceeded(serverGuide);
    expect(await screen.findByText('Identify Your Issues')).toBeInTheDocument();

    const dismissMock = MockApiClient.addMockResponse({
      method: 'PUT',
      url: '/assistant/',
    });

    userEvent.click(screen.getByLabelText('Dismiss'), undefined, {
      skipPointerEventsCheck: true,
    });

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

    expect(screen.queryByText('Identify Your Issues')).not.toBeInTheDocument();
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

  it('renders children when disabled', async function () {
    render(
      <GuideAnchor disabled target="exception">
        <div data-test-id="child-div" />
      </GuideAnchor>
    );

    expect(screen.queryByTestId('guide-container')).not.toBeInTheDocument();
    expect(screen.getByTestId('child-div')).toBeInTheDocument();
  });

  it('if forceHide is true, do not render guide', async function () {
    render(
      <div>
        <GuideAnchor target="issue_number" />
        <GuideAnchor target="exception" />
      </div>
    );

    GuideStore.fetchSucceeded(serverGuide);
    expect(await screen.findByText('Identify Your Issues')).toBeInTheDocument();
    GuideStore.setForceHide(true);
    expect(screen.queryByText('Identify Your Issues')).not.toBeInTheDocument();
    GuideStore.setForceHide(false);
    expect(await screen.findByText('Identify Your Issues')).toBeInTheDocument();
  });
});
