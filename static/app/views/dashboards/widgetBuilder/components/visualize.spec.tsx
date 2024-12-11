import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {RouterFixture} from 'sentry-fixture/routerFixture';

import {render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';

import type {TagCollection} from 'sentry/types/group';
import useCustomMeasurements from 'sentry/utils/useCustomMeasurements';
import {DisplayType, WidgetType} from 'sentry/views/dashboards/types';
import Visualize from 'sentry/views/dashboards/widgetBuilder/components/visualize';
import {WidgetBuilderProvider} from 'sentry/views/dashboards/widgetBuilder/contexts/widgetBuilderContext';
import {useSpanTags} from 'sentry/views/explore/contexts/spanTagsContext';

jest.mock('sentry/utils/useCustomMeasurements');
jest.mock('sentry/views/explore/contexts/spanTagsContext');

describe('Visualize', () => {
  let organization;

  beforeEach(() => {
    organization = OrganizationFixture({
      features: ['dashboards-widget-builder-redesign', 'performance-view'],
    });

    jest.mocked(useCustomMeasurements).mockReturnValue({
      customMeasurements: {},
    });

    jest.mocked(useSpanTags).mockReturnValue({});
  });

  it('renders basic aggregates correctly from the URL params', async () => {
    render(
      <WidgetBuilderProvider>
        <Visualize />
      </WidgetBuilderProvider>,
      {
        organization,
        router: RouterFixture({
          location: LocationFixture({
            query: {
              yAxis: ['p90(transaction.duration)', 'max(spans.db)'],
              dataset: WidgetType.TRANSACTIONS,
              displayType: DisplayType.LINE,
            },
          }),
        }),
      }
    );

    expect(await screen.findByText('+ Add Series')).toBeInTheDocument();
    const p90FieldRow = (await screen.findByText('p90')).closest(
      '[data-testid="field-bar"]'
    ) as HTMLElement;
    expect(p90FieldRow).toBeInTheDocument();
    expect(within(p90FieldRow).getByText('transaction.duration')).toBeInTheDocument();

    const maxFieldRow = (await screen.findByText('max')).closest(
      '[data-testid="field-bar"]'
    ) as HTMLElement;
    expect(maxFieldRow).toBeInTheDocument();
    expect(within(maxFieldRow).getByText('spans.db')).toBeInTheDocument();
  });

  it('allows adding and deleting series', async () => {
    render(
      <WidgetBuilderProvider>
        <Visualize />
      </WidgetBuilderProvider>,
      {
        organization,
        router: RouterFixture({
          location: LocationFixture({
            query: {
              yAxis: ['max(spans.db)'],
              dataset: WidgetType.TRANSACTIONS,
              displayType: DisplayType.LINE,
            },
          }),
        }),
      }
    );

    expect(await screen.findByRole('button', {name: 'Remove field'})).toBeDisabled();

    await userEvent.click(screen.getByRole('button', {name: 'Add Series'}));

    expect(screen.queryAllByRole('button', {name: 'Remove field'})[0]).toBeEnabled();
    await userEvent.click(screen.queryAllByRole('button', {name: 'Remove field'})[0]);

    expect(screen.queryAllByRole('button', {name: 'Remove field'})[0]).toBeDisabled();
  });

  it('disables the column selection when the aggregate has no parameters', async () => {
    render(
      <WidgetBuilderProvider>
        <Visualize />
      </WidgetBuilderProvider>,
      {
        organization,
        router: RouterFixture({
          location: LocationFixture({
            query: {
              yAxis: ['max(spans.db)'],
              dataset: WidgetType.TRANSACTIONS,
              displayType: DisplayType.LINE,
            },
          }),
        }),
      }
    );

    expect(screen.getByRole('button', {name: 'Column Selection'})).toBeEnabled();
    await userEvent.click(screen.getByRole('button', {name: 'Aggregate Selection'}));
    await userEvent.click(screen.getByRole('option', {name: 'count'}));

    expect(screen.getByRole('button', {name: 'Column Selection'})).toBeDisabled();
    expect(screen.getByRole('button', {name: 'Aggregate Selection'})).toBeEnabled();

    expect(screen.getByRole('button', {name: 'Column Selection'})).toHaveValue('');
  });

  it('adds the default value for the column selection when the aggregate has parameters', async () => {
    render(
      <WidgetBuilderProvider>
        <Visualize />
      </WidgetBuilderProvider>,
      {
        organization,
        router: RouterFixture({
          location: LocationFixture({
            query: {
              yAxis: ['count()'],
              dataset: WidgetType.TRANSACTIONS,
              displayType: DisplayType.LINE,
            },
          }),
        }),
      }
    );

    expect(screen.getByRole('button', {name: 'Column Selection'})).toBeDisabled();

    await userEvent.click(screen.getByRole('button', {name: 'Aggregate Selection'}));
    await userEvent.click(screen.getByRole('option', {name: 'p95'}));

    expect(screen.getByRole('button', {name: 'Column Selection'})).toBeEnabled();
    expect(screen.getByRole('button', {name: 'Column Selection'})).toHaveTextContent(
      'transaction.duration'
    );
    expect(screen.getByRole('button', {name: 'Aggregate Selection'})).toHaveTextContent(
      'p95'
    );
  });

  it('maintains the selected aggregate when the column selection is changed and there are parameters', async () => {
    render(
      <WidgetBuilderProvider>
        <Visualize />
      </WidgetBuilderProvider>,
      {
        organization,
        router: RouterFixture({
          location: LocationFixture({
            query: {
              yAxis: ['max(spans.db)'],
              dataset: WidgetType.TRANSACTIONS,
              displayType: DisplayType.LINE,
            },
          }),
        }),
      }
    );

    await userEvent.click(screen.getByRole('button', {name: 'Aggregate Selection'}));
    await userEvent.click(screen.getByRole('option', {name: 'p95'}));

    expect(screen.getByRole('button', {name: 'Column Selection'})).toHaveTextContent(
      'spans.db'
    );
    expect(screen.getByRole('button', {name: 'Aggregate Selection'})).toHaveTextContent(
      'p95'
    );
  });

  describe('spans', () => {
    beforeEach(() => {
      jest.mocked(useSpanTags).mockImplementation((type?: 'string' | 'number') => {
        if (type === 'number') {
          return {
            'tags[span.duration,number]': {
              key: 'span.duration',
              name: 'span.duration',
              kind: 'measurement',
            },
            'tags[anotherNumericTag,number]': {
              key: 'anotherNumericTag',
              name: 'anotherNumericTag',
              kind: 'measurement',
            },
          } as TagCollection;
        }

        return {
          'span.description': {
            key: 'span.description',
            name: 'span.description',
            kind: 'tag',
          },
        } as TagCollection;
      });
    });

    it('shows numeric tags as primary options for chart widgets', async () => {
      render(
        <WidgetBuilderProvider>
          <Visualize />
        </WidgetBuilderProvider>,
        {
          organization,
          router: RouterFixture({
            location: LocationFixture({
              query: {
                dataset: WidgetType.SPANS,
                displayType: DisplayType.LINE,
                yAxis: ['p90(span.duration)'],
              },
            }),
          }),
        }
      );

      await userEvent.click(
        await screen.findByRole('button', {name: 'Column Selection'})
      );

      const listbox = await screen.findByRole('listbox', {name: 'Column Selection'});
      expect(within(listbox).getByText('anotherNumericTag')).toBeInTheDocument();
      expect(within(listbox).queryByText('span.description')).not.toBeInTheDocument();
    });

    it('shows the correct aggregate options', async () => {
      render(
        <WidgetBuilderProvider>
          <Visualize />
        </WidgetBuilderProvider>,
        {
          organization,
          router: RouterFixture({
            location: LocationFixture({
              query: {
                dataset: WidgetType.SPANS,
                displayType: DisplayType.LINE,
                yAxis: ['count(span.duration)'],
              },
            }),
          }),
        }
      );

      await userEvent.click(
        await screen.findByRole('button', {name: 'Aggregate Selection'})
      );

      // count has two entries because it's already selected
      // and in the dropdown
      expect(screen.getAllByText('count')).toHaveLength(2);
      expect(screen.getByText('avg')).toBeInTheDocument();
      expect(screen.getByText('max')).toBeInTheDocument();
      expect(screen.getByText('min')).toBeInTheDocument();
      expect(screen.getByText('p50')).toBeInTheDocument();
      expect(screen.getByText('p75')).toBeInTheDocument();
      expect(screen.getByText('p90')).toBeInTheDocument();
      expect(screen.getByText('p95')).toBeInTheDocument();
      expect(screen.getByText('p99')).toBeInTheDocument();
      expect(screen.getByText('p100')).toBeInTheDocument();
      expect(screen.getByText('sum')).toBeInTheDocument();
    });
  });
});
