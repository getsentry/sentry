import type EChartsReact from 'echarts-for-react';
import type {EChartsInstance} from 'echarts-for-react';

import {act, renderHook, waitFor} from 'sentry-test/reactTestingLibrary';

import {useChartXRangeSelection} from './useChartXRangeSelection';

describe('useChartXRangeSelection', () => {
  const mockChartRef = {
    current: null as EChartsReact | null,
  };

  const mockChartInstance: EChartsInstance = {
    getModel: jest.fn(),
    dispatchAction: jest.fn(),
    setOption: jest.fn(),
    convertToPixel: jest.fn().mockReturnValue(100),
    getDom: jest.fn().mockReturnValue({
      getBoundingClientRect: jest.fn().mockReturnValue({
        left: 50,
        top: 100,
      }),
    }),
  } as unknown as EChartsInstance;

  const mockAxis = {
    axis: {
      scale: {
        getExtent: jest.fn(),
      },
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockChartRef.current = null;
  });

  describe('initial state', () => {
    it('should return brush configuration when not disabled', () => {
      const {result} = renderHook(() =>
        useChartXRangeSelection({
          chartRef: mockChartRef,
        })
      );

      expect(result.current.brush).toBeDefined();
      expect(result.current.toolBox).toBeDefined();
    });

    it('should return undefined brush when disabled', () => {
      const {result} = renderHook(() =>
        useChartXRangeSelection({
          chartRef: mockChartRef,
          disabled: true,
        })
      );

      expect(result.current.brush).toBeUndefined();
      expect(result.current.toolBox).toBeUndefined();
    });
  });

  describe('onBrushStart handler', () => {
    it('should hide tooltip when brush starts', () => {
      const onSelectionStart = jest.fn();

      const {result} = renderHook(() =>
        useChartXRangeSelection({
          chartRef: mockChartRef,
          onSelectionStart,
        })
      );

      act(() => {
        result.current.onBrushStart({} as any, mockChartInstance);
      });

      expect(mockChartInstance.dispatchAction).toHaveBeenCalledWith({
        type: 'hideTip',
      });
      expect(onSelectionStart).toHaveBeenCalled();
    });

    it('should disconnect chart group when chartsGroupName is provided', () => {
      const disconnectSpy = jest.fn();
      jest.spyOn(require('echarts'), 'disconnect').mockImplementation(disconnectSpy);

      const {result} = renderHook(() =>
        useChartXRangeSelection({
          chartRef: mockChartRef,
          chartsGroupName: 'test-group',
        })
      );

      act(() => {
        result.current.onBrushStart({} as any, mockChartInstance);
      });

      expect(disconnectSpy).toHaveBeenCalledWith('test-group');
    });
  });

  describe('onBrushEnd handler', () => {
    it('should set selection with clamped coordinates', () => {
      const onSelectionEnd = jest.fn();

      const mockEchartsInstance = {
        ...mockChartInstance,
        getModel: jest.fn().mockReturnValue({
          getComponent: jest.fn((type: string) => {
            if (type === 'xAxis') {
              return {
                axis: {
                  scale: {
                    getExtent: () => [0, 100],
                  },
                },
              };
            }
            if (type === 'yAxis') {
              return {
                axis: {
                  scale: {
                    getExtent: () => [0, 50],
                  },
                },
              };
            }
            return mockAxis;
          }),
        }),
        convertToPixel: jest.fn((_config, value) => {
          if (value === 100) return 500;
          if (value === 90) return 450;
          if (value === 10) return 50;
          return 0;
        }),
      } as any;

      mockChartRef.current = {
        getEchartsInstance: () => mockEchartsInstance,
      } as unknown as EChartsReact;

      const {result} = renderHook(() =>
        useChartXRangeSelection({
          chartRef: mockChartRef,
          onSelectionEnd,
        })
      );

      const mockEvent = {
        areas: [
          {
            coordRange: [10, 90],
            panelId: 'test-panel-id',
          },
        ],
      };

      act(() => {
        result.current.onBrushEnd(mockEvent as any, mockEchartsInstance);
      });

      expect(onSelectionEnd).toHaveBeenCalledWith(
        {
          range: [10, 90],
          panelId: 'test-panel-id',
        },
        expect.any(Function)
      );
    });

    it('should clamp coordinates that exceed axis bounds', () => {
      const onSelectionEnd = jest.fn();

      const mockEchartsInstance = {
        ...mockChartInstance,
        getModel: jest.fn().mockReturnValue({
          getComponent: jest.fn((type: string) => {
            if (type === 'xAxis') {
              return {
                axis: {
                  scale: {
                    getExtent: () => [0, 100],
                  },
                },
              };
            }
            if (type === 'yAxis') {
              return {
                axis: {
                  scale: {
                    getExtent: () => [0, 50],
                  },
                },
              };
            }
            return mockAxis;
          }),
        }),
        convertToPixel: jest.fn().mockReturnValue(100),
      } as any;

      mockChartRef.current = {
        getEchartsInstance: () => mockEchartsInstance,
      } as unknown as EChartsReact;

      const {result} = renderHook(() =>
        useChartXRangeSelection({
          chartRef: mockChartRef,
          onSelectionEnd,
        })
      );

      const mockEvent = {
        areas: [
          {
            coordRange: [-10, 150], // Exceeds bounds
            panelId: 'test-panel-id',
          },
        ],
      };

      act(() => {
        result.current.onBrushEnd(mockEvent as any, mockEchartsInstance);
      });

      expect(onSelectionEnd).toHaveBeenCalledWith(
        {
          range: [0, 100], // Clamped to bounds
          panelId: 'test-panel-id',
        },
        expect.any(Function)
      );
    });

    it('should reconnect chart group after brush ends', async () => {
      const connectSpy = jest.fn();
      jest.spyOn(require('echarts'), 'connect').mockImplementation(connectSpy);

      const mockEchartsInstance = {
        ...mockChartInstance,
        getModel: jest.fn().mockReturnValue({
          getComponent: jest.fn((type: string) => {
            if (type === 'xAxis') {
              return {
                axis: {scale: {getExtent: () => [0, 100]}},
              };
            }
            if (type === 'yAxis') {
              return {
                axis: {scale: {getExtent: () => [0, 50]}},
              };
            }
            return mockAxis;
          }),
        }),
        convertToPixel: jest.fn().mockReturnValue(100),
        dispatchAction: jest.fn(),
      } as any;

      mockChartRef.current = {
        getEchartsInstance: () => mockEchartsInstance,
      } as unknown as EChartsReact;

      const {result} = renderHook(() =>
        useChartXRangeSelection({
          chartRef: mockChartRef,
          chartsGroupName: 'test-group',
        })
      );

      const mockEvent = {
        areas: [{coordRange: [10, 90], panelId: 'test-panel-id'}],
      };

      act(() => {
        result.current.onBrushEnd(mockEvent as any, mockEchartsInstance);
      });

      // Wait for effect to run
      await waitFor(() => {
        expect(connectSpy).toHaveBeenCalledWith('test-group');
      });
    });
  });

  describe('actionMenuRenderer', () => {
    it('should render action menu when selection is made', async () => {
      const mockEchartsInstance = {
        ...mockChartInstance,
        getModel: jest.fn().mockReturnValue({
          getComponent: jest.fn((type: string) => {
            if (type === 'xAxis') {
              return {
                axis: {scale: {getExtent: () => [0, 100]}},
              };
            }
            if (type === 'yAxis') {
              return {
                axis: {scale: {getExtent: () => [0, 50]}},
              };
            }
            return mockAxis;
          }),
        }),
        convertToPixel: jest.fn().mockReturnValue(100),
      } as any;

      mockChartRef.current = {
        getEchartsInstance: () => mockEchartsInstance,
      } as unknown as EChartsReact;

      const actionMenuRenderer = jest.fn((_selection, _clearSelection) => (
        <div data-test-id="action-menu">Action Menu</div>
      ));

      const {result} = renderHook(() =>
        useChartXRangeSelection({
          chartRef: mockChartRef,
          actionMenuRenderer,
        })
      );

      act(() => {
        result.current.onBrushEnd(
          {areas: [{coordRange: [10, 90], panelId: 'test-panel-id'}]} as any,
          mockEchartsInstance
        );
      });

      await waitFor(() => {
        expect(result.current.ActionMenu).not.toBeNull();
      });

      expect(actionMenuRenderer).toHaveBeenCalledWith(
        {range: [10, 90], panelId: 'test-panel-id'},
        expect.any(Function)
      );
    });

    it('should position action menu to the left when selection is on the right side', async () => {
      const mockEchartsInstance = {
        ...mockChartInstance,
        getModel: jest.fn().mockReturnValue({
          getComponent: jest.fn((type: string) => {
            if (type === 'xAxis') {
              return {
                axis: {scale: {getExtent: () => [0, 100]}},
              };
            }
            if (type === 'yAxis') {
              return {
                axis: {scale: {getExtent: () => [0, 50]}},
              };
            }
            return mockAxis;
          }),
        }),
        convertToPixel: jest.fn((_config, value) => {
          if (value === 100) return 500; // xMax
          if (value === 90) return 480; // Above 60% threshold
          return 0;
        }),
      } as any;

      mockChartRef.current = {
        getEchartsInstance: () => mockEchartsInstance,
      } as unknown as EChartsReact;

      const {result} = renderHook(() =>
        useChartXRangeSelection({
          chartRef: mockChartRef,
          actionMenuRenderer: (_selection, _clearSelection) => (
            <div data-test-id="action-menu">Action Menu</div>
          ),
        })
      );

      act(() => {
        result.current.onBrushEnd(
          {areas: [{coordRange: [10, 90], panelId: 'test-panel-id'}]} as any,
          mockEchartsInstance
        );
      });

      await waitFor(() => {
        expect(result.current.ActionMenu).not.toBeNull();
      });
    });
  });

  describe('outside click handling', () => {
    it('should clear selection when clicking outside selection region', async () => {
      const mockEchartsInstance = {
        ...mockChartInstance,
        getModel: jest.fn().mockReturnValue({
          getComponent: jest.fn((type: string) => {
            if (type === 'xAxis') {
              return {
                axis: {scale: {getExtent: () => [0, 100]}},
              };
            }
            if (type === 'yAxis') {
              return {
                axis: {scale: {getExtent: () => [0, 50]}},
              };
            }
            return mockAxis;
          }),
        }),
        convertToPixel: jest.fn().mockReturnValue(100),
      } as any;

      mockChartRef.current = {
        getEchartsInstance: () => mockEchartsInstance,
      } as unknown as EChartsReact;

      const {result} = renderHook(() =>
        useChartXRangeSelection({
          chartRef: mockChartRef,
        })
      );

      // Create a selection
      act(() => {
        result.current.onBrushEnd(
          {areas: [{coordRange: [10, 90], panelId: 'test-panel-id'}]} as any,
          mockEchartsInstance
        );
      });

      // Simulate outside click
      const outsideElement = document.createElement('div');
      document.body.appendChild(outsideElement);

      act(() => {
        const clickEvent = new MouseEvent('click', {bubbles: true});
        outsideElement.dispatchEvent(clickEvent);
      });

      await waitFor(() => {
        expect(mockEchartsInstance.dispatchAction).toHaveBeenCalledWith({
          type: 'brush',
          areas: [],
        });
      });

      document.body.removeChild(outsideElement);
    });

    it('should not clear selection when clicking inside selection region', () => {
      const mockEchartsInstance = {
        ...mockChartInstance,
        getModel: jest.fn().mockReturnValue({
          getComponent: jest.fn((type: string) => {
            if (type === 'xAxis') {
              return {
                axis: {scale: {getExtent: () => [0, 100]}},
              };
            }
            if (type === 'yAxis') {
              return {
                axis: {scale: {getExtent: () => [0, 50]}},
              };
            }
            return mockAxis;
          }),
        }),
        convertToPixel: jest.fn().mockReturnValue(100),
      } as any;

      mockChartRef.current = {
        getEchartsInstance: () => mockEchartsInstance,
      } as unknown as EChartsReact;

      const {result} = renderHook(() =>
        useChartXRangeSelection({
          chartRef: mockChartRef,
        })
      );

      // Create a selection
      act(() => {
        result.current.onBrushEnd(
          {areas: [{coordRange: [10, 90], panelId: 'test-panel-id'}]} as any,
          mockEchartsInstance
        );
      });

      // Create element inside selection region
      const insideElement = document.createElement('div');
      insideElement.dataset.exploreChartSelectionRegion = '';
      document.body.appendChild(insideElement);

      const dispatchCallCount = mockEchartsInstance.dispatchAction.mock.calls.length;

      act(() => {
        const clickEvent = new MouseEvent('click', {bubbles: true});
        insideElement.dispatchEvent(clickEvent);
      });

      // Should not call dispatchAction again (no clear)
      expect(mockEchartsInstance.dispatchAction.mock.calls).toHaveLength(
        dispatchCallCount
      );

      document.body.removeChild(insideElement);
    });
  });

  describe('brush mode activation', () => {
    it('should activate brush mode on mount', async () => {
      const mockEchartsInstance = {
        ...mockChartInstance,
        dispatchAction: jest.fn(),
      } as any;

      mockChartRef.current = {
        getEchartsInstance: () => mockEchartsInstance,
      } as unknown as EChartsReact;

      renderHook(() =>
        useChartXRangeSelection({
          chartRef: mockChartRef,
        })
      );

      await waitFor(() => {
        expect(mockEchartsInstance.dispatchAction).toHaveBeenCalledWith({
          type: 'takeGlobalCursor',
          key: 'brush',
          brushOption: expect.objectContaining({
            brushType: 'lineX',
            brushMode: 'single',
          }),
        });
      });
    });

    it('should re-activate brush mode when deps change', async () => {
      const mockEchartsInstance = {
        ...mockChartInstance,
        dispatchAction: jest.fn(),
      } as any;

      mockChartRef.current = {
        getEchartsInstance: () => mockEchartsInstance,
      } as unknown as EChartsReact;

      const {rerender} = renderHook(
        ({deps}) =>
          useChartXRangeSelection({
            chartRef: mockChartRef,
            deps,
          }),
        {initialProps: {deps: [1]}}
      );

      await waitFor(() => {
        expect(mockEchartsInstance.dispatchAction).toHaveBeenCalled();
      });

      const callCount = mockEchartsInstance.dispatchAction.mock.calls.length;

      rerender({deps: [2]});

      await waitFor(() => {
        expect(mockEchartsInstance.dispatchAction.mock.calls.length).toBeGreaterThan(
          callCount
        );
      });
    });
  });
});
