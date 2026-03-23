import {OrganizationFixture} from 'sentry-fixture/organization';

import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {trackAnalytics} from 'sentry/utils/analytics';
import {useUrlConversationDrawer} from 'sentry/views/insights/pages/conversations/hooks/useUrlConversationDrawer';

import {useConversationViewDrawer} from './conversationDrawer';

jest.mock('sentry/utils/analytics');
jest.mock(
  'sentry/views/insights/pages/conversations/hooks/useUrlConversationDrawer',
  () => ({
    useUrlConversationDrawer: jest.fn(),
  })
);

const mockedTrackAnalytics = trackAnalytics as jest.Mock;
const mockedUseUrlConversationDrawer = useUrlConversationDrawer as unknown as jest.Mock;

describe('useConversationViewDrawer', () => {
  const mockOpenDrawer = jest.fn();

  beforeEach(() => {
    jest.resetAllMocks();

    mockedUseUrlConversationDrawer.mockReturnValue({
      openDrawer: mockOpenDrawer,
      isDrawerOpen: false,
      drawerUrlState: {
        conversationId: 'conversation-1',
        startTimestamp: 1700000000,
        endTimestamp: 1700000100,
        focusedTool: 'weather-tool',
      },
    });
  });

  it('preserves focusedTool when auto-opening from a direct link', async () => {
    renderHookWithProviders(() => useConversationViewDrawer(), {
      organization: OrganizationFixture({slug: 'test-org'}),
    });

    await waitFor(() => {
      expect(mockOpenDrawer).toHaveBeenCalledTimes(1);
    });

    expect(mockOpenDrawer).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({
        conversationId: 'conversation-1',
        startTimestamp: 1700000000,
        endTimestamp: 1700000100,
        focusedTool: 'weather-tool',
      })
    );

    expect(mockedTrackAnalytics).toHaveBeenCalledWith(
      'conversations.drawer.open',
      expect.objectContaining({source: 'direct_link'})
    );
  });
});
