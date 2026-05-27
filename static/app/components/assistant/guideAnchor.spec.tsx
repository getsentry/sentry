import {ConfigFixture} from 'sentry-fixture/config';
import {UserFixture} from 'sentry-fixture/user';

import {act, render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {GuideAnchor} from 'sentry/components/assistant/guideAnchor';
import {ConfigStore} from 'sentry/stores/configStore';
import {GuideStore} from 'sentry/stores/guideStore';

describe('GuideAnchor', () => {
  const serverGuide = [
    {
      guide: 'trace_view',
      seen: false,
    },
  ];
  const firstGuideHeader = 'Event Breakdown';

  beforeEach(() => {
    ConfigStore.loadInitialData(
      ConfigFixture({
        user: UserFixture({
          isSuperuser: false,
          dateJoined: '2020-01-01T00:00:00',
        }),
      })
    );
  });

  it('renders, async advances, async and finishes', async () => {
    render(
      <div>
        <GuideAnchor target="trace_view_guide_breakdown" />
        <GuideAnchor target="trace_view_guide_row" />
        <GuideAnchor target="trace_view_guide_row_details" />
      </div>
    );

    act(() => GuideStore.fetchSucceeded(serverGuide));
    expect(await screen.findByText(firstGuideHeader)).toBeInTheDocument();

    await userEvent.click(screen.getByLabelText('Next'));

    expect(await screen.findByText('Events')).toBeInTheDocument();
    expect(screen.queryByText(firstGuideHeader)).not.toBeInTheDocument();

    await userEvent.click(screen.getByLabelText('Next'));

    expect(await screen.findByText('Event Details')).toBeInTheDocument();
    expect(screen.queryByText('Events')).not.toBeInTheDocument();

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
          guide: 'trace_view',
          status: 'viewed',
        },
      })
    );
  });

  it('dismisses', async () => {
    render(
      <div>
        <GuideAnchor target="trace_view_guide_breakdown" />
        <GuideAnchor target="trace_view_guide_row" />
        <GuideAnchor target="trace_view_guide_row_details" />
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
          guide: 'trace_view',
          status: 'dismissed',
        },
      })
    );

    expect(screen.queryByText(firstGuideHeader)).not.toBeInTheDocument();
  });

  it('renders no container when inactive', () => {
    render(
      <GuideAnchor target="target 1">
        <span data-test-id="child-div" />
      </GuideAnchor>
    );

    expect(screen.queryByTestId('guide-container')).not.toBeInTheDocument();
    expect(screen.getByTestId('child-div')).toBeInTheDocument();
  });

  it('renders children when disabled', () => {
    render(
      <GuideAnchor disabled target="exception">
        <div data-test-id="child-div" />
      </GuideAnchor>
    );

    expect(screen.queryByTestId('guide-container')).not.toBeInTheDocument();
    expect(screen.getByTestId('child-div')).toBeInTheDocument();
  });

  it('if forceHide is true, async do not render guide', async () => {
    render(
      <div>
        <GuideAnchor target="trace_view_guide_breakdown" />
        <GuideAnchor target="trace_view_guide_row" />
        <GuideAnchor target="trace_view_guide_row_details" />
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
