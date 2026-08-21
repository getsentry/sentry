import {usePopper} from 'react-popper';

import {renderHook} from 'sentry-test/reactTestingLibrary';

import {useOverlay} from 'sentry/utils/useOverlay';

jest.mock('react-popper', () => ({
  usePopper: jest.fn(),
}));

const mockUsePopper = jest.mocked(usePopper);
const mockPopperUpdate = jest.fn();

describe('useOverlay', () => {
  beforeEach(() => {
    mockPopperUpdate.mockReset();
    mockUsePopper.mockReturnValue({
      attributes: {},
      forceUpdate: null,
      state: null,
      styles: {arrow: {}, popper: {}},
      update: mockPopperUpdate,
    });
  });

  it('updates Popper when a controlled overlay opens', () => {
    const {rerender} = renderHook(({isOpen}) => useOverlay({isOpen}), {
      initialProps: {isOpen: false},
    });

    expect(mockPopperUpdate).not.toHaveBeenCalled();

    rerender({isOpen: true});

    expect(mockPopperUpdate).toHaveBeenCalledTimes(1);
  });
});
