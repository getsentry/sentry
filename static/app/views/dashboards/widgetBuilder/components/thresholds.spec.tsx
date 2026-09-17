import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {DisplayType} from 'sentry/views/dashboards/types';
import {ThresholdsSection as Thresholds} from 'sentry/views/dashboards/widgetBuilder/components/thresholds';
import {
  useWidgetBuilderContext,
  WidgetBuilderProvider,
} from 'sentry/views/dashboards/widgetBuilder/contexts/widgetBuilderContext';

describe('Thresholds', () => {
  it('sets thresholds to undefined if the thresholds are fully wiped', async () => {
    const {router} = render(
      <WidgetBuilderProvider>
        <Thresholds dataType="duration" dataUnit="millisecond" />
      </WidgetBuilderProvider>,
      {
        initialRouterConfig: {
          location: {
            pathname: '/mock-pathname/',
            query: {
              thresholds: '{"max_values":{"max1":100},"unit":"millisecond"}',
            },
          },
        },
      }
    );

    await userEvent.clear(screen.getByLabelText('First Maximum'));

    await waitFor(() => {
      expect(router.location.query).not.toHaveProperty('thresholds');
    });
  });

  it('shows new thresholds as fixed values', async () => {
    render(
      <WidgetBuilderProvider>
        <Thresholds dataType="duration" dataUnit="millisecond" />
      </WidgetBuilderProvider>,
      {
        initialRouterConfig: {
          location: {
            pathname: '/mock-pathname/',
            query: {
              displayType: DisplayType.LINE,
            },
          },
        },
      }
    );

    await userEvent.type(screen.getByLabelText('First Maximum'), '100');
    await userEvent.type(screen.getByLabelText('Second Maximum'), '200');
    await userEvent.tab();

    expect(screen.getByText('Fixed')).toBeInTheDocument();
    expect(screen.getByLabelText('Second Minimum')).toHaveValue(100);
    expect(screen.getByLabelText('Third Minimum')).toHaveValue(200);
  });

  it('shows the saved threshold interval', () => {
    render(
      <WidgetBuilderProvider>
        <Thresholds dataType="integer" />
      </WidgetBuilderProvider>,
      {
        initialRouterConfig: {
          location: {
            pathname: '/mock-pathname/',
            query: {
              displayType: DisplayType.LINE,
              interval: '1h',
              thresholds:
                '{"max_values":{"max1":100,"max2":200},"unit":null,"timeWindow":"10m"}',
            },
          },
        },
      }
    );

    expect(screen.getByText('10 minutes')).toBeInTheDocument();
  });

  it('explains how the threshold interval affects displayed values', async () => {
    render(
      <WidgetBuilderProvider>
        <Thresholds dataType="integer" />
      </WidgetBuilderProvider>,
      {
        initialRouterConfig: {
          location: {
            pathname: '/mock-pathname/',
            query: {
              displayType: DisplayType.LINE,
              thresholds: '{"max_values":{"max1":100},"unit":null}',
            },
          },
        },
      }
    );

    await userEvent.hover(screen.getByTestId('more-information'));

    expect(
      await screen.findByText(
        'Threshold values are defined for this interval and scale to match the dashboard interval.'
      )
    ).toBeInTheDocument();
  });

  it('updates the unit when applied', async () => {
    const {router} = render(
      <WidgetBuilderProvider>
        <Thresholds dataType="duration" dataUnit="millisecond" />
      </WidgetBuilderProvider>,
      {
        initialRouterConfig: {
          location: {
            pathname: '/mock-pathname/',
            query: {
              thresholds: '{"max_values":{"max1":100,"max2":200},"unit":"millisecond"}',
            },
          },
        },
      }
    );

    await userEvent.click(screen.getAllByText('millisecond')[0]!);
    await userEvent.click(screen.getByText('second'));

    await waitFor(() => {
      expect(router.location.query.thresholds).toBe(
        '{"max_values":{"max1":100,"max2":200},"unit":"second"}'
      );
    });
  });

  it('displays error', async () => {
    render(
      <WidgetBuilderProvider>
        <Thresholds
          dataType="duration"
          dataUnit="millisecond"
          error={{thresholds: {max1: 'error on max 1', max2: 'error on max 2'}}}
        />
      </WidgetBuilderProvider>,
      {
        initialRouterConfig: {
          location: {
            pathname: '/mock-pathname/',
            query: {
              thresholds: '{"max_values":{"max1":-200,"max2":100},"unit":"millisecond"}',
            },
          },
        },
      }
    );

    expect(await screen.findByText('error on max 1')).toBeInTheDocument();
    expect(await screen.findByText('error on max 2')).toBeInTheDocument();
  });

  it('accepts decimal values', async () => {
    const {router} = render(
      <WidgetBuilderProvider>
        <Thresholds dataType="duration" dataUnit="millisecond" />
      </WidgetBuilderProvider>
    );

    await userEvent.type(screen.getByLabelText('First Maximum'), '0.5');
    await userEvent.type(screen.getByLabelText('Second Maximum'), '100.5456');

    expect((await screen.findAllByDisplayValue('0.5'))[0]).toBeInTheDocument();
    expect((await screen.findAllByDisplayValue('100.5456'))[0]).toBeInTheDocument();

    await waitFor(() => {
      expect(router.location.query.thresholds).toBe(
        '{"max_values":{"max1":0.5,"max2":100.5456},"unit":null}'
      );
    });
  });

  it('preserves preferred polarity when thresholds are cleared', async () => {
    let capturedState: any = null;

    function StateCapture() {
      const {state} = useWidgetBuilderContext();
      // oxlint-disable-next-line react/globals -- Test captures the hook result in an outer variable to assert on it.
      capturedState = state;
      return null;
    }

    render(
      <WidgetBuilderProvider>
        <StateCapture />
        <Thresholds dataType="duration" dataUnit="millisecond" />
      </WidgetBuilderProvider>,
      {
        initialRouterConfig: {
          location: {
            pathname: '/mock-pathname/',
            query: {
              thresholds:
                '{"max_values":{"max1":100},"unit":"millisecond","preferredPolarity":"+"}',
            },
          },
        },
      }
    );

    expect(capturedState.thresholds?.preferredPolarity).toBe('+');

    await userEvent.clear(screen.getByLabelText('First Maximum'));

    expect(capturedState.thresholds?.preferredPolarity).toBe('+');
  });

  it('sets internal state to null (not undefined) when thresholds are fully wiped', async () => {
    let capturedState: any = null;

    // Test component that captures the internal state
    // This lets us more easily test the internal state of the hook where it
    // deviates from the URL param update (e.g. null vs undefined behavior)
    function StateCapture() {
      const {state} = useWidgetBuilderContext();
      // oxlint-disable-next-line react/globals -- Test captures the hook result in an outer variable to assert on it.
      capturedState = state;
      return null;
    }

    render(
      <WidgetBuilderProvider>
        <StateCapture />
        <Thresholds dataType="duration" dataUnit="millisecond" />
      </WidgetBuilderProvider>,
      {
        initialRouterConfig: {
          location: {
            pathname: '/mock-pathname/',
            query: {
              thresholds: '{"max_values":{"max1":100},"unit":"millisecond"}',
            },
          },
        },
      }
    );

    // Verify initial state has thresholds
    expect(capturedState.thresholds).not.toBeNull();

    // Clear the threshold value
    await userEvent.clear(screen.getByLabelText('First Maximum'));

    // Wait for state update and verify it's null, not undefined
    expect(capturedState.thresholds).toBeNull();
  });
});
