import {autoUpdate, useFloating} from '@floating-ui/react-dom';

import {renderHook} from 'sentry-test/reactTestingLibrary';

import {useOverlay} from 'sentry/utils/useOverlay';

jest.mock('@floating-ui/react-dom', () => ({
  ...jest.requireActual('@floating-ui/react-dom'),
  useFloating: jest.fn(),
}));

const mockUseFloating = jest.mocked(useFloating);

describe('useOverlay', () => {
  beforeEach(() => {
    mockUseFloating.mockReturnValue({
      x: 0,
      y: 0,
      placement: 'top',
      strategy: 'absolute',
      middlewareData: {},
      isPositioned: false,
      update: jest.fn(),
      refs: {
        reference: {current: null},
        floating: {current: null},
        setReference: jest.fn(),
        setFloating: jest.fn(),
      },
      elements: {reference: null, floating: null},
      floatingStyles: {},
    });
  });

  it('follows the trigger once a controlled overlay opens', () => {
    const {rerender} = renderHook(({isOpen}) => useOverlay({isOpen}), {
      initialProps: {isOpen: false},
    });

    expect(mockUseFloating).toHaveBeenLastCalledWith(
      expect.objectContaining({whileElementsMounted: undefined})
    );

    rerender({isOpen: true});

    expect(mockUseFloating).toHaveBeenLastCalledWith(
      expect.objectContaining({whileElementsMounted: autoUpdate})
    );
  });
});
