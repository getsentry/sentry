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
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
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
        expect.objectContaining({
          selectionState: expect.objectContaining({
            selection: {
              range: [10, 90],
              panelId: 'test-panel-id',
            },
          }),
          setSelectionState: expect.any(Function),
          clearSelection: expect.any(Function),
        })
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
        expect.objectContaining({
          selectionState: expect.objectContaining({
            selection: {
              range: [0, 100], // Clamped to bounds
              panelId: 'test-panel-id',
            },
          }),
          setSelectionState: expect.any(Function),
          clearSelection: expect.any(Function),
        })
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

      const actionMenuRenderer = jest.fn(_params => (
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

      // actionMenuRenderer is called with callbackParams which includes the selection state
      expect(actionMenuRenderer).toHaveBeenCalledWith(
        expect.objectContaining({
          selectionState: expect.objectContaining({
            selection: expect.objectContaining({
              range: [10, 90],
              panelId: 'test-panel-id',
            }),
          }),
          setSelectionState: expect.any(Function),
          clearSelection: expect.any(Function),
        })
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
          actionMenuRenderer: _params => (
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

  describe('initialSelection handling', () => {
    it('should initialize selection state from initialSelection prop', async () => {
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

      const initialSelection = {
        range: [20, 80] as [number, number],
        panelId: 'initial-panel-id',
      };

      renderHook(() =>
        useChartXRangeSelection({
          chartRef: mockChartRef,
          initialSelection,
        })
      );

      await waitFor(() => {
        expect(mockEchartsInstance.dispatchAction).toHaveBeenCalledWith({
          type: 'brush',
          areas: [
            expect.objectContaining({
              brushType: 'lineX',
              coordRange: [20, 80],
              panelId: 'initial-panel-id',
            }),
          ],
        });
      });
    });

    it('should clear selection when initialSelection is removed', async () => {
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
        setOption: jest.fn(),
      } as any;

      mockChartRef.current = {
        getEchartsInstance: () => mockEchartsInstance,
      } as unknown as EChartsReact;

      const initialSelection = {
        range: [20, 80] as [number, number],
        panelId: 'initial-panel-id',
      };

      const {rerender} = renderHook(
        ({selection}) =>
          useChartXRangeSelection({
            chartRef: mockChartRef,
            initialSelection: selection,
          }),
        {
          initialProps: {
            selection: initialSelection as typeof initialSelection | undefined,
          },
        }
      );

      // Wait for initial selection to be set
      await waitFor(() => {
        expect(mockEchartsInstance.dispatchAction).toHaveBeenCalledWith({
          type: 'brush',
          areas: [
            expect.objectContaining({
              coordRange: [20, 80],
            }),
          ],
        });
      });

      // Remove initialSelection (simulating back navigation to unselected state)
      rerender({selection: undefined});

      await waitFor(() => {
        expect(mockEchartsInstance.dispatchAction).toHaveBeenCalledWith({
          type: 'brush',
          areas: [],
        });
      });
    });

    it('should update selection when initialSelection range changes', async () => {
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

      const initialSelection = {
        range: [20, 80] as [number, number],
        panelId: 'initial-panel-id',
      };

      const {rerender} = renderHook(
        ({selection}) =>
          useChartXRangeSelection({
            chartRef: mockChartRef,
            initialSelection: selection,
          }),
        {initialProps: {selection: initialSelection}}
      );

      // Wait for initial selection to be set
      await waitFor(() => {
        expect(mockEchartsInstance.dispatchAction).toHaveBeenCalledWith({
          type: 'brush',
          areas: [
            expect.objectContaining({
              coordRange: [20, 80],
            }),
          ],
        });
      });

      const newSelection = {
        range: [30, 70] as [number, number],
        panelId: 'initial-panel-id',
      };

      // Change initialSelection (simulating back navigation to different selection)
      rerender({selection: newSelection});

      await waitFor(() => {
        expect(mockEchartsInstance.dispatchAction).toHaveBeenCalledWith({
          type: 'brush',
          areas: [
            expect.objectContaining({
              coordRange: [30, 70],
            }),
          ],
        });
      });
    });
  });

  describe('click callbacks', () => {
    it('should call onInsideSelectionClick when clicking inside the selection box', async () => {
      const onInsideSelectionClick = jest.fn();

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
          // Selection range pixels: xMin=50, xMax=150
          // yMin pixel = 200
          if (value === 100) return 200; // xMax extent
          if (value === 0) return 200; // yMin extent
          if (value === 10) return 50; // selection xMin
          if (value === 90) return 150; // selection xMax
          return 100;
        }),
        getDom: jest.fn().mockReturnValue({
          getBoundingClientRect: jest.fn().mockReturnValue({
            left: 0,
            top: 0,
          }),
        }),
        dispatchAction: jest.fn(),
      } as any;

      mockChartRef.current = {
        getEchartsInstance: () => mockEchartsInstance,
      } as unknown as EChartsReact;

      const {result} = renderHook(() =>
        useChartXRangeSelection({
          chartRef: mockChartRef,
          onInsideSelectionClick,
        })
      );

      // Create a selection first
      act(() => {
        result.current.onBrushEnd(
          {areas: [{coordRange: [10, 90], panelId: 'test-panel-id'}]} as any,
          mockEchartsInstance
        );
      });

      // Simulate a click inside the selection box (clientX=100 is between 50 and 150)
      const clickEvent = new MouseEvent('click', {
        clientX: 100,
        clientY: 100,
        bubbles: true,
      });

      act(() => {
        document.body.dispatchEvent(clickEvent);
      });

      await waitFor(() => {
        expect(onInsideSelectionClick).toHaveBeenCalledWith(
          expect.objectContaining({
            selectionState: expect.objectContaining({
              selection: expect.objectContaining({
                range: [10, 90],
              }),
            }),
          })
        );
      });
    });

    it('should call onOutsideSelectionClick when clicking outside the selection box', async () => {
      const onOutsideSelectionClick = jest.fn();

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
          // Selection range pixels: xMin=50, xMax=150
          // yMin pixel = 200
          if (value === 100) return 200; // xMax extent
          if (value === 0) return 200; // yMin extent
          if (value === 10) return 50; // selection xMin
          if (value === 90) return 150; // selection xMax
          return 100;
        }),
        getDom: jest.fn().mockReturnValue({
          getBoundingClientRect: jest.fn().mockReturnValue({
            left: 0,
            top: 0,
          }),
        }),
        dispatchAction: jest.fn(),
      } as any;

      mockChartRef.current = {
        getEchartsInstance: () => mockEchartsInstance,
      } as unknown as EChartsReact;

      const {result} = renderHook(() =>
        useChartXRangeSelection({
          chartRef: mockChartRef,
          onOutsideSelectionClick,
        })
      );

      // Create a selection first
      act(() => {
        result.current.onBrushEnd(
          {areas: [{coordRange: [10, 90], panelId: 'test-panel-id'}]} as any,
          mockEchartsInstance
        );
      });

      // Simulate a click outside the selection box (clientX=200 is > 150)
      const clickEvent = new MouseEvent('click', {
        clientX: 200,
        clientY: 100,
        bubbles: true,
      });

      act(() => {
        document.body.dispatchEvent(clickEvent);
      });

      await waitFor(() => {
        expect(onOutsideSelectionClick).toHaveBeenCalledWith(
          expect.objectContaining({
            selectionState: expect.objectContaining({
              selection: expect.objectContaining({
                range: [10, 90],
              }),
            }),
          })
        );
      });
    });

    it('should not call onOutsideSelectionClick when clicking on an action menu item', () => {
      const onOutsideSelectionClick = jest.fn();

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
          if (value === 100) return 200;
          if (value === 0) return 200;
          if (value === 10) return 50;
          if (value === 90) return 150;
          return 100;
        }),
        getDom: jest.fn().mockReturnValue({
          getBoundingClientRect: jest.fn().mockReturnValue({
            left: 0,
            top: 0,
          }),
        }),
        dispatchAction: jest.fn(),
      } as any;

      mockChartRef.current = {
        getEchartsInstance: () => mockEchartsInstance,
      } as unknown as EChartsReact;

      const {result} = renderHook(() =>
        useChartXRangeSelection({
          chartRef: mockChartRef,
          onOutsideSelectionClick,
        })
      );

      // Create a selection first
      act(() => {
        result.current.onBrushEnd(
          {areas: [{coordRange: [10, 90], panelId: 'test-panel-id'}]} as any,
          mockEchartsInstance
        );
      });

      // Create an action menu element with the data attribute
      const actionMenuElement = document.createElement('div');
      actionMenuElement.dataset.chartXRangeSelectionActionMenu = '';
      const menuButton = document.createElement('button');
      actionMenuElement.appendChild(menuButton);
      document.body.appendChild(actionMenuElement);

      // Simulate a click on the menu button (child of action menu)
      const clickEvent = new MouseEvent('click', {
        clientX: 200, // Outside selection box
        clientY: 100,
        bubbles: true,
      });
      Object.defineProperty(clickEvent, 'target', {value: menuButton});

      act(() => {
        document.body.dispatchEvent(clickEvent);
      });

      // onOutsideSelectionClick should NOT be called because click was on action menu
      expect(onOutsideSelectionClick).not.toHaveBeenCalled();

      document.body.removeChild(actionMenuElement);
    });
  });
});
