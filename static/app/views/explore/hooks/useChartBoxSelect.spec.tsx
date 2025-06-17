import type EChartsReact from 'echarts-for-react';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {act, renderHook, waitFor} from 'sentry-test/reactTestingLibrary';

import {Visualize} from 'sentry/views/explore/contexts/pageParamsContext/visualizes';
import {OrganizationContext} from 'sentry/views/organizationContext';

import {EXPLORE_CHART_BRUSH_OPTION, useChartBoxSelect} from './useChartBoxSelect';

describe('useChartBoxSelect', () => {
  const organization = OrganizationFixture({
    features: ['performance-spans-suspect-attributes'],
  });
  const mockChartRef = {
    current: null as EChartsReact | null,
  };

  const mockChartInstance = {
    getModel: jest.fn(),
    dispatchAction: jest.fn(),
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
      const visualizes = [new Visualize(['count()'], {label: 'A'})];
      const {result} = renderHook(
        () => useChartBoxSelect({chartRef: mockChartRef, visualizes}),
        {wrapper}
      );
      expect(result.current.brushArea).toBeNull();
    });
  });

  describe('box select enablement', () => {
    it('should enable box select for single visualization with single y-axis', () => {
      const visualizes = [new Visualize(['count()'], {label: 'A'})];
      const {result} = renderHook(
        () => useChartBoxSelect({chartRef: mockChartRef, visualizes}),
        {wrapper}
      );

      expect(result.current.brush).toBeDefined();
      expect(result.current.toolBox).toBeDefined();
    });

    it('should disable box select for multiple visualizations', () => {
      const visualizes = [
        new Visualize(['count()'], {label: 'A'}),
        new Visualize(['avg(span.duration)'], {label: 'B'}),
      ];
      const {result} = renderHook(
        () => useChartBoxSelect({chartRef: mockChartRef, visualizes}),
        {wrapper}
      );

      expect(result.current.brush).toBeUndefined();
      expect(result.current.toolBox).toBeUndefined();
    });

    it('should disable box select for single visualization with multiple y-axes', () => {
      const visualizes = [new Visualize(['count()', 'avg(span.duration)'], {label: 'A'})];
      const {result} = renderHook(
        () => useChartBoxSelect({chartRef: mockChartRef, visualizes}),
        {wrapper}
      );

      expect(result.current.brush).toBeUndefined();
      expect(result.current.toolBox).toBeUndefined();
    });

    it('should disable box select when some visualizations have multiple y-axes', () => {
      const visualizes = [
        new Visualize(['count()'], {label: 'A'}),
        new Visualize(['count()', 'avg(span.duration)'], {label: 'B'}),
      ];
      const {result} = renderHook(
        () => useChartBoxSelect({chartRef: mockChartRef, visualizes}),
        {wrapper}
      );

      expect(result.current.brush).toBeUndefined();
      expect(result.current.toolBox).toBeUndefined();
    });
  });

  describe('brush configuration', () => {
    it('should return correct brush configuration when enabled', () => {
      const visualizes = [new Visualize(['count()'], {label: 'A'})];
      const {result} = renderHook(
        () => useChartBoxSelect({chartRef: mockChartRef, visualizes}),
        {wrapper}
      );

      expect(result.current.brush).toEqual(EXPLORE_CHART_BRUSH_OPTION);
    });
  });

  describe('onBrushEnd handler', () => {
    it('should handle brush end event correctly', async () => {
      const visualizes = [new Visualize(['count()'], {label: 'A'})];

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
        () => useChartBoxSelect({chartRef: mockChartRef, visualizes}),
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
        expect(result.current.brushArea).toEqual([
          {
            ...mockEvent.areas[0],
            coordRange: [
              [10, 90], // within x bounds
              [5, 45], // within y bounds
            ],
          },
        ]);
      });
    });

    it('should constrain brush area to axis bounds', async () => {
      const visualizes = [new Visualize(['count()'], {label: 'A'})];

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
        () => useChartBoxSelect({chartRef: mockChartRef, visualizes}),
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
        expect(result.current.brushArea).toEqual([
          {
            ...mockEvent.areas[0],
            coordRange: [
              [0, 100], // constrained to x bounds
              [0, 50], // constrained to y bounds
            ],
          },
        ]);
      });
    });

    it('should not set brush area if chartRef is null', () => {
      const visualizes = [new Visualize(['count()'], {label: 'A'})];

      const {result} = renderHook(
        () => useChartBoxSelect({chartRef: mockChartRef, visualizes}),
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

      expect(result.current.brushArea).toBeNull();
    });
  });

  describe('chart redraw effect', () => {
    it('should dispatch brush action when brushArea changes', () => {
      const visualizes = [new Visualize(['count()'], {label: 'A'})];

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
        () => useChartBoxSelect({chartRef: mockChartRef, visualizes}),
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

  describe('configuration changes based on visualizations', () => {
    it('should update configuration when visualizations change', () => {
      let visualizes = [new Visualize(['count()'], {label: 'A'})];

      const {result, rerender} = renderHook(
        ({visualizes: hookVisualizes}) =>
          useChartBoxSelect({chartRef: mockChartRef, visualizes: hookVisualizes}),
        {
          initialProps: {visualizes},
          wrapper,
        }
      );

      // Initially enabled
      expect(result.current.brush).toBeDefined();
      expect(result.current.toolBox).toBeDefined();

      // Change to multiple visualizations - should disable
      visualizes = [
        new Visualize(['count()'], {label: 'A'}),
        new Visualize(['avg(span.duration)'], {label: 'B'}),
      ];

      rerender({visualizes});

      expect(result.current.brush).toBeUndefined();
      expect(result.current.toolBox).toBeUndefined();
    });
  });
});
