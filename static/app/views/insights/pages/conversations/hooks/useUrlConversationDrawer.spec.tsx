import {renderHook} from 'sentry-test/reactTestingLibrary';

import useDrawer from 'sentry/components/globalDrawer';
import {useConversationDrawerQueryState} from 'sentry/views/insights/pages/conversations/utils/urlParams';

import {useUrlConversationDrawer} from './useUrlConversationDrawer';

jest.mock('sentry/components/globalDrawer');
jest.mock('sentry/views/insights/pages/conversations/utils/urlParams', () => {
  const actual = jest.requireActual(
    'sentry/views/insights/pages/conversations/utils/urlParams'
  );
  return {
    ...actual,
    useConversationDrawerQueryState: jest.fn(),
  };
});

const mockedUseDrawer = useDrawer as unknown as jest.Mock;
const mockedUseConversationDrawerQueryState =
  useConversationDrawerQueryState as unknown as jest.Mock;

describe('useUrlConversationDrawer', () => {
  const mockBaseOpenDrawer = jest.fn();
  const mockBaseCloseDrawer = jest.fn();
  const mockSetConversationDrawerQueryState = jest.fn();

  beforeEach(() => {
    jest.resetAllMocks();

    mockedUseDrawer.mockReturnValue({
      openDrawer: mockBaseOpenDrawer,
      closeDrawer: mockBaseCloseDrawer,
      isDrawerOpen: false,
      panelRef: {current: null},
    });

    mockedUseConversationDrawerQueryState.mockReturnValue([
      {
        conversationId: null,
        spanId: null,
        startTimestamp: null,
        endTimestamp: null,
        focusedTool: null,
      },
      mockSetConversationDrawerQueryState,
    ]);
  });

  it('clears focusedTool when opening without focusedTool option', () => {
    const {result} = renderHook(() => useUrlConversationDrawer());

    result.current.openDrawer(() => null, {
      ariaLabel: 'Conversation Drawer',
      conversationId: 'conversation-1',
      startTimestamp: 1,
      endTimestamp: 2,
    });

    expect(mockSetConversationDrawerQueryState).toHaveBeenCalledWith({
      conversationId: 'conversation-1',
      startTimestamp: 1,
      endTimestamp: 2,
      focusedTool: null,
    });
  });

  it('preserves focusedTool when provided', () => {
    const {result} = renderHook(() => useUrlConversationDrawer());

    result.current.openDrawer(() => null, {
      ariaLabel: 'Conversation Drawer',
      conversationId: 'conversation-1',
      focusedTool: 'weather-tool',
    });

    expect(mockSetConversationDrawerQueryState).toHaveBeenCalledWith({
      conversationId: 'conversation-1',
      startTimestamp: undefined,
      endTimestamp: undefined,
      focusedTool: 'weather-tool',
    });
  });
});
