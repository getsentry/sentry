import {LocationFixture} from 'sentry-fixture/locationFixture';
import {RouterFixture} from 'sentry-fixture/routerFixture';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {useNavigate} from 'sentry/utils/useNavigate';
import Thresholds from 'sentry/views/dashboards/widgetBuilder/components/thresholds';
import {WidgetBuilderProvider} from 'sentry/views/dashboards/widgetBuilder/contexts/widgetBuilderContext';

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
        router: RouterFixture({
          location: LocationFixture({
            query: {
              thresholds: '{"max_values":{"max1":100},"unit":"millisecond"}',
            },
          }),
        }),
      }
    );

    await userEvent.clear(screen.getByLabelText('First Maximum'));

    expect(mockNavigate).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.objectContaining({
          thresholds: undefined,
        }),
      }),
      {replace: true}
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
      {replace: true}
    );
  });

  it('updates the unit when applied', async () => {
    render(
      <WidgetBuilderProvider>
        <Thresholds dataType="duration" dataUnit="millisecond" />
      </WidgetBuilderProvider>,
      {
        router: RouterFixture({
          location: LocationFixture({
            query: {
              thresholds: '{"max_values":{"max1":100,"max2":200},"unit":"millisecond"}',
            },
          }),
        }),
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
      {replace: true}
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
        router: RouterFixture({
          location: LocationFixture({
            query: {
              thresholds: '{"max_values":{"max1":-200,"max2":100},"unit":"millisecond"}',
            },
          }),
        }),
      }
    );

    expect(await screen.findByText('error on max 1')).toBeInTheDocument();
    expect(await screen.findByText('error on max 2')).toBeInTheDocument();
  });
});
