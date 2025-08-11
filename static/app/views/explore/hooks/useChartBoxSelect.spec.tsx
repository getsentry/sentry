import type EChartsReact from 'echarts-for-react';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {act, renderHook, waitFor} from 'sentry-test/reactTestingLibrary';

import {OrganizationContext} from 'sentry/views/organizationContext';

import {EXPLORE_CHART_BRUSH_OPTION, useChartBoxSelect} from './useChartBoxSelect';

describe('useChartBoxSelect', () => {
  const organization = OrganizationFixture({
    features: ['performance-spans-suspect-attributes'],
  });
  const mockChartRef = {
    current: null as EChartsReact | null,
  };

  const mockChartWrapperRef = {
    current: null as HTMLDivElement | null,
  };

  const mockTriggerWrapperRef = {
    current: null as HTMLDivElement | null,
  };

  const mockChartInstance = {
    getModel: jest.fn(),
    dispatchAction: jest.fn(),
    convertToPixel: jest.fn().mockReturnValue([100, 200]),
    getDom: jest.fn().mockReturnValue({
      getBoundingClientRect: jest.fn().mockReturnValue({
        left: 50,
        top: 100,
      }),
    }),
  };

  const mockAxis = {
    axis: {
      scale: {
        getExtent: jest.fn(),
      },
    },
  };

  const wrapper = ({children}: {children: React.ReactNode}) => (
    <OrganizationContext.Provider value={organization}>
      {children}
    </OrganizationContext.Provider>
  );

  beforeEach(() => {
    jest.clearAllMocks();
    mockChartRef.current = null;
  });

  describe('initial state', () => {
    it('should initialize with null brushArea', () => {
      const {result} = renderHook(
        () =>
          useChartBoxSelect({
            chartRef: mockChartRef,
            chartWrapperRef: mockChartWrapperRef,
            triggerWrapperRef: mockTriggerWrapperRef,
          }),
        {wrapper}
      );
      expect(result.current.boxCoordRange).toBeNull();
    });
  });

  describe('brush configuration', () => {
    it('should return correct brush configuration when enabled', () => {
      const {result} = renderHook(
        () =>
          useChartBoxSelect({
            chartRef: mockChartRef,
            chartWrapperRef: mockChartWrapperRef,
            triggerWrapperRef: mockTriggerWrapperRef,
          }),
        {wrapper}
      );

      expect(result.current.brush).toEqual(EXPLORE_CHART_BRUSH_OPTION);
    });
  });

  describe('onBrushEnd handler', () => {
    it('should handle brush end event correctly', async () => {
      // Mock chart instance and methods
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
      } as any;

      mockChartRef.current = {
        getEchartsInstance: () => mockEchartsInstance,
      } as unknown as EChartsReact;

      const {result} = renderHook(
        () =>
          useChartBoxSelect({
            chartRef: mockChartRef,
            chartWrapperRef: mockChartWrapperRef,
            triggerWrapperRef: mockTriggerWrapperRef,
          }),
        {wrapper}
      );

      const mockEvent = {
        areas: [
          {
            coordRange: [
              [10, 90], // x range
              [5, 45], // y range
            ],
            range: [
              [10, 90], // x range
              [5, 45], // y range
            ],
          },
        ],
        brushId: 'test-brush-id',
        type: 'brushend' as const,
      };

      act(() => {
        result.current.onBrushEnd(mockEvent, mockEchartsInstance);
      });

      await waitFor(() => {
        expect(result.current.boxCoordRange).toEqual({
          x: [10, 90], // within x bounds
          y: [5, 45], // within y bounds
        });
      });
    });

    it('should constrain brush area to axis bounds', async () => {
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
      } as any;

      mockChartRef.current = {
        getEchartsInstance: () => mockEchartsInstance,
      } as unknown as EChartsReact;

      const {result} = renderHook(
        () =>
          useChartBoxSelect({
            chartRef: mockChartRef,
            chartWrapperRef: mockChartWrapperRef,
            triggerWrapperRef: mockTriggerWrapperRef,
          }),
        {wrapper}
      );

      const mockEvent = {
        areas: [
          {
            coordRange: [
              [-10, 150], // x range exceeding bounds
              [-5, 60], // y range exceeding bounds
            ],
            range: [
              [-10, 150], // x range exceeding bounds
              [-5, 60], // y range exceeding bounds
            ],
          },
        ],
        brushId: 'test-brush-id',
        type: 'brushend' as const,
      };

      act(() => {
        result.current.onBrushEnd(mockEvent, mockEchartsInstance);
      });

      await waitFor(() => {
        expect(result.current.boxCoordRange).toEqual({
          x: [0, 100], // constrained to x bounds
          y: [0, 50], // constrained to y bounds
        });
      });
    });

    it('should not set brush area if chartRef is null', () => {
      const {result} = renderHook(
        () =>
          useChartBoxSelect({
            chartRef: mockChartRef,
            chartWrapperRef: mockChartWrapperRef,
            triggerWrapperRef: mockTriggerWrapperRef,
          }),
        {wrapper}
      );

      const mockEvent = {
        areas: [
          {
            coordRange: [
              [10, 90],
              [5, 45],
            ],
            range: [
              [10, 90],
              [5, 45],
            ],
          },
        ],
        brushId: 'test-brush-id',
        type: 'brushend' as const,
      };

      act(() => {
        result.current.onBrushEnd(mockEvent, mockChartInstance as any);
      });

      expect(result.current.boxCoordRange).toBeNull();
    });
  });

  describe('chart redraw effect', () => {
    it('should dispatch brush action when brushArea changes', () => {
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
      };

      mockChartRef.current = {
        getEchartsInstance: () => mockEchartsInstance,
      } as unknown as EChartsReact;

      const {result} = renderHook(
        () =>
          useChartBoxSelect({
            chartRef: mockChartRef,
            chartWrapperRef: mockChartWrapperRef,
            triggerWrapperRef: mockTriggerWrapperRef,
          }),
        {wrapper}
      );

      const mockEvent = {
        areas: [
          {
            coordRange: [
              [10, 90],
              [5, 45],
            ],
            range: [
              [10, 90],
              [5, 45],
            ],
          },
        ],
        brushId: 'test-brush-id',
        type: 'brushend' as const,
      };

      act(() => {
        result.current.onBrushEnd(mockEvent, mockEchartsInstance as any);
      });

      expect(mockEchartsInstance.dispatchAction).toHaveBeenCalledWith({
        type: 'brush',
        areas: [
          {
            ...mockEvent.areas[0],
            coordRange: [
              [10, 90],
              [5, 45],
            ],
          },
        ],
      });
    });
  });
});
