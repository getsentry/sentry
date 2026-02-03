import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {useNavigate} from 'sentry/utils/useNavigate';
import Thresholds from 'sentry/views/dashboards/widgetBuilder/components/thresholds';
import {
  useWidgetBuilderContext,
  WidgetBuilderProvider,
} from 'sentry/views/dashboards/widgetBuilder/contexts/widgetBuilderContext';

jest.mock('sentry/utils/useNavigate');
describe('Thresholds', () => {
  let mockNavigate!: jest.Mock;

  beforeEach(() => {
    mockNavigate = jest.fn();
    jest.mocked(useNavigate).mockReturnValue(mockNavigate);
  });

  it('sets thresholds to undefined if the thresholds are fully wiped', async () => {
    render(
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

    expect(mockNavigate).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.objectContaining({
          thresholds: undefined,
        }),
      }),
      expect.anything()
    );
  });

  it('sets a threshold when applied', async () => {
    render(
      <WidgetBuilderProvider>
        <Thresholds dataType="duration" dataUnit="millisecond" />
      </WidgetBuilderProvider>
    );

    await userEvent.type(screen.getByLabelText('First Maximum'), '100');
    await userEvent.type(screen.getByLabelText('Second Maximum'), '200');
    await userEvent.tab();

    expect(mockNavigate).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.objectContaining({
          thresholds: '{"max_values":{"max1":100,"max2":200},"unit":null}',
        }),
      }),
      expect.anything()
    );
  });

  it('updates the unit when applied', async () => {
    render(
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

    expect(mockNavigate).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.objectContaining({
          thresholds: '{"max_values":{"max1":100,"max2":200},"unit":"second"}',
        }),
      }),
      expect.anything()
    );
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
    render(
      <WidgetBuilderProvider>
        <Thresholds dataType="duration" dataUnit="millisecond" />
      </WidgetBuilderProvider>
    );

    await userEvent.type(screen.getByLabelText('First Maximum'), '0.5');
    await userEvent.type(screen.getByLabelText('Second Maximum'), '100.5456');

    expect((await screen.findAllByDisplayValue('0.5'))[0]).toBeInTheDocument();
    expect((await screen.findAllByDisplayValue('100.5456'))[0]).toBeInTheDocument();

    expect(mockNavigate).toHaveBeenLastCalledWith(
      expect.objectContaining({
        query: expect.objectContaining({
          thresholds: '{"max_values":{"max1":0.5,"max2":100.5456},"unit":null}',
        }),
      }),
      expect.anything()
    );
  });

  it('sets internal state to null (not undefined) when thresholds are fully wiped', async () => {
    let capturedState: any = null;

    // Test component that captures the internal state
    // This lets us more easily test the internal state of the hook where it
    // deviates from the URL param update (e.g. null vs undefined behavior)
    function StateCapture() {
      const {state} = useWidgetBuilderContext();
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
