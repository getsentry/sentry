import {OrganizationFixture} from 'sentry-fixture/organization';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  act,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import {openModal} from 'sentry/actionCreators/modal';
import type {TagCollection} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import {parseFunction} from 'sentry/utils/discover/fields';
import {FieldKind} from 'sentry/utils/fields';
import {isGroupBy} from 'sentry/views/explore/contexts/pageParamsContext/aggregateFields';
import {DEFAULT_VISUALIZATION} from 'sentry/views/explore/contexts/pageParamsContext/visualizes';
import type {
  AggregateField,
  WritableAggregateField,
} from 'sentry/views/explore/queryParams/aggregateField';
import {VisualizeFunction} from 'sentry/views/explore/queryParams/visualize';
import {AggregateColumnEditorModal} from 'sentry/views/explore/tables/aggregateColumnEditorModal';

const stringTags: TagCollection = {
  id: {
    key: 'id',
    name: 'id',
    kind: FieldKind.TAG,
  },
  project: {
    key: 'project',
    name: 'project',
    kind: FieldKind.TAG,
  },
  'span.op': {
    key: 'span.op',
    name: 'span.op',
    kind: FieldKind.TAG,
  },
  'geo.country': {
    key: 'geo.country',
    name: 'geo.country',
    kind: FieldKind.TAG,
  },
  'geo.city': {
    key: 'geo.city',
    name: 'geo.city',
    kind: FieldKind.TAG,
  },
};

const numberTags: TagCollection = {
  'span.duration': {
    key: 'span.duration',
    name: 'span.duration',
    kind: FieldKind.MEASUREMENT,
  },
  'span.self_time': {
    key: 'span.self_time',
    name: 'span.self_time',
    kind: FieldKind.MEASUREMENT,
  },
  'tags[foo,number]': {
    key: 'tags[foo,number]',
    name: 'foo',
    kind: FieldKind.MEASUREMENT,
  },
};

const booleanTags: TagCollection = {
  'feature.enabled': {
    key: 'feature.enabled',
    name: 'feature.enabled',
    kind: FieldKind.BOOLEAN,
  },
};

describe('AggregateColumnEditorModal', () => {
  beforeEach(() => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/trace-items/attributes/',
      method: 'GET',
      body: [
        {attributeType: 'string', key: 'span.op', name: 'span.op'},
        {attributeType: 'number', key: 'span.duration', name: 'span.duration'},
        {attributeType: 'number', key: 'span.self_time', name: 'span.self_time'},
      ],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/recent-searches/',
      method: 'GET',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/recent-searches/',
      method: 'POST',
      body: [],
    });
  });

  it('allows closes modal on apply', async () => {
    const onClose = jest.fn();

    renderGlobalModal();

    act(() => {
      openModal(
        modalProps => (
          <AggregateColumnEditorModal
            {...modalProps}
            columns={[{groupBy: ''}, new VisualizeFunction(DEFAULT_VISUALIZATION)]}
            onColumnsChange={() => {}}
            stringTags={stringTags}
            numberTags={numberTags}
            booleanTags={booleanTags}
          />
        ),
        {onClose}
      );
    });

    expect(onClose).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', {name: 'Apply'}));
    expect(onClose).toHaveBeenCalled();
  });

  it('can delete aggregate fields until there is 1 of the type left', async () => {
    const onColumnsChange = jest.fn();

    renderGlobalModal();

    act(() => {
      openModal(
        modalProps => (
          <AggregateColumnEditorModal
            {...modalProps}
            columns={[
              {groupBy: 'geo.country'},
              {groupBy: 'geo.region'},
              new VisualizeFunction('count(span.duration)'),
              new VisualizeFunction('avg(span.self_time)'),
            ]}
            onColumnsChange={onColumnsChange}
            stringTags={stringTags}
            numberTags={numberTags}
            booleanTags={booleanTags}
          />
        ),
        {onClose: jest.fn()}
      );
    });

    let rows: HTMLElement[];

    rows = await screen.findAllByTestId('editor-row');
    expectRows(rows).toHaveAggregateFields([
      {groupBy: 'geo.country'},
      {groupBy: 'geo.region'},
      new VisualizeFunction('count(span.duration)'),
      new VisualizeFunction('avg(span.self_time)'),
    ]);

    await userEvent.click(screen.getAllByLabelText('Remove Column')[0]!);

    rows = await screen.findAllByTestId('editor-row');
    expectRows(rows).toHaveAggregateFields([
      {groupBy: 'geo.region'},
      new VisualizeFunction('count(span.duration)'),
      new VisualizeFunction('avg(span.self_time)'),
    ]);

    // only 1 group by remaining, disable the delete option
    expect(screen.getAllByLabelText('Remove Column')[0]).toBeDisabled();

    await userEvent.click(screen.getAllByLabelText('Remove Column')[1]!);

    rows = await screen.findAllByTestId('editor-row');
    expectRows(rows).toHaveAggregateFields([
      {groupBy: 'geo.region'},
      new VisualizeFunction('avg(span.self_time)'),
    ]);

    // 1 group by and visualize remaining so both should be disabled
    screen
      .getAllByLabelText('Remove Column')
      .forEach(element => expect(element).toBeDisabled());

    await userEvent.click(screen.getByRole('button', {name: 'Apply'}));
    expect(onColumnsChange).toHaveBeenCalledWith([
      {groupBy: 'geo.region'},
      {yAxes: ['avg(span.self_time)']},
    ]);
  });

  it('handles duplicate visualize columns without collapsing rows', async () => {
    const onColumnsChange = jest.fn();

    renderGlobalModal();

    act(() => {
      openModal(
        modalProps => (
          <AggregateColumnEditorModal
            {...modalProps}
            columns={[
              {groupBy: 'geo.country'},
              new VisualizeFunction('count(span.duration)'),
              new VisualizeFunction('count(span.duration)'),
            ]}
            onColumnsChange={onColumnsChange}
            stringTags={stringTags}
            numberTags={numberTags}
            booleanTags={booleanTags}
          />
        ),
        {onClose: jest.fn()}
      );
    });

    let rows = await screen.findAllByTestId('editor-row');
    expectRows(rows).toHaveAggregateFields([
      {groupBy: 'geo.country'},
      new VisualizeFunction('count(span.duration)'),
      new VisualizeFunction('count(span.duration)'),
    ]);

    await userEvent.click(screen.getAllByLabelText('Remove Column')[2]!);

    rows = await screen.findAllByTestId('editor-row');
    expectRows(rows).toHaveAggregateFields([
      {groupBy: 'geo.country'},
      new VisualizeFunction('count(span.duration)'),
    ]);

    await userEvent.click(screen.getByRole('button', {name: 'Apply'}));
    expect(onColumnsChange).toHaveBeenCalledWith([
      {groupBy: 'geo.country'},
      {yAxes: ['count(span.duration)']},
    ]);
  });

  it('allows adding a column', async () => {
    const onColumnsChange = jest.fn();

    renderGlobalModal();

    act(() => {
      openModal(
        modalProps => (
          <AggregateColumnEditorModal
            {...modalProps}
            columns={[
              {groupBy: 'geo.country'},
              new VisualizeFunction(DEFAULT_VISUALIZATION),
            ]}
            onColumnsChange={onColumnsChange}
            stringTags={stringTags}
            numberTags={numberTags}
            booleanTags={booleanTags}
          />
        ),
        {onClose: jest.fn()}
      );
    });

    let rows: HTMLElement[];

    rows = await screen.findAllByTestId('editor-row');
    expectRows(rows).toHaveAggregateFields([
      {groupBy: 'geo.country'},
      new VisualizeFunction('count(span.duration)'),
    ]);

    await userEvent.click(screen.getByRole('button', {name: 'Add a Column'}));
    await userEvent.click(
      screen.getByRole('menuitemradio', {name: 'Group By / Attribute'})
    );

    rows = await screen.findAllByTestId('editor-row');
    expectRows(rows).toHaveAggregateFields([
      {groupBy: 'geo.country'},
      new VisualizeFunction('count(span.duration)'),
      {groupBy: ''},
    ]);

    await userEvent.click(screen.getByRole('button', {name: 'Add a Column'}));
    await userEvent.click(
      screen.getByRole('menuitemradio', {name: 'Visualize / Function'})
    );

    rows = await screen.findAllByTestId('editor-row');
    expectRows(rows).toHaveAggregateFields([
      {groupBy: 'geo.country'},
      new VisualizeFunction('count(span.duration)'),
      {groupBy: ''},
      new VisualizeFunction('count(span.duration)'),
    ]);

    await userEvent.click(screen.getByRole('button', {name: 'Apply'}));

    expect(onColumnsChange).toHaveBeenCalledWith([
      {groupBy: 'geo.country'},
      {yAxes: ['count(span.duration)']},
      {groupBy: ''},
      {yAxes: ['count(span.duration)']},
    ]);
  });

  it('allows changing a column', async () => {
    const onColumnsChange = jest.fn();

    renderGlobalModal();

    act(() => {
      openModal(
        modalProps => (
          <AggregateColumnEditorModal
            {...modalProps}
            columns={[
              {groupBy: 'geo.country'},
              new VisualizeFunction(DEFAULT_VISUALIZATION),
            ]}
            onColumnsChange={onColumnsChange}
            stringTags={stringTags}
            numberTags={numberTags}
            booleanTags={booleanTags}
          />
        ),
        {onClose: jest.fn()}
      );
    });

    let rows: HTMLElement[];

    rows = await screen.findAllByTestId('editor-row');
    expectRows(rows).toHaveAggregateFields([
      {groupBy: 'geo.country'},
      new VisualizeFunction('count(span.duration)'),
    ]);

    const options: string[] = [
      '\u2014',
      'geo.city',
      'project',
      'span.duration',
      'span.op',
      'span.self_time',
      'feature.enabled',
      'foo',
      'geo.country',
    ];

    const row = screen.getAllByTestId('editor-row')[0]!;

    await userEvent.click(
      within(row).getByRole('button', {name: 'Group By geo.country'})
    );
    const groupByOptions = await screen.findAllByRole('option');
    groupByOptions.forEach((option, i) => {
      expect(option).toHaveTextContent(options[i]!);
    });

    await userEvent.click(groupByOptions[1]!);
    rows = await screen.findAllByTestId('editor-row');
    expectRows(rows).toHaveAggregateFields([
      {groupBy: 'geo.city'},
      new VisualizeFunction('count(span.duration)'),
    ]);

    await userEvent.click(screen.getByRole('button', {name: 'Apply'}));
    expect(onColumnsChange).toHaveBeenCalledWith([
      {groupBy: 'geo.city'},
      {yAxes: ['count(span.duration)']},
    ]);
  });

  it('allows adding an equation', async () => {
    const {organization} = initializeOrg();

    const onColumnsChange = jest.fn();

    renderGlobalModal({organization});

    act(() => {
      openModal(
        modalProps => (
          <AggregateColumnEditorModal
            {...modalProps}
            columns={[
              {groupBy: 'geo.country'},
              new VisualizeFunction(DEFAULT_VISUALIZATION),
            ]}
            onColumnsChange={onColumnsChange}
            stringTags={stringTags}
            numberTags={numberTags}
            booleanTags={booleanTags}
          />
        ),
        {onClose: jest.fn()}
      );
    });

    await userEvent.click(screen.getByRole('button', {name: 'Add a Column'}));
    await userEvent.click(screen.getByRole('menuitemradio', {name: 'Equation'}));

    await userEvent.click(screen.getByRole('combobox', {name: 'Add a term'}));

    await userEvent.keyboard('avg(foo{Enter}*5{Escape}');

    await userEvent.click(screen.getByRole('button', {name: 'Apply'}));
    expect(onColumnsChange).toHaveBeenCalledWith([
      {groupBy: 'geo.country'},
      {yAxes: ['count(span.duration)']},
      {yAxes: ['equation|avg(tags[foo,number]) * 5']},
    ]);
  });

  describe('conditional aggregates', () => {
    const SERIES_FILTER_PLACEHOLDER = 'Filter spans for this series';

    const organizationWithConditionalAggregates = OrganizationFixture({
      features: ['explore-conditional-aggregates'],
    });

    function renderModal({
      columns,
      onColumnsChange = jest.fn(),
      organization,
    }: {
      columns: AggregateField[];
      onColumnsChange?: (columns: WritableAggregateField[]) => void;
      organization?: Organization;
    }) {
      renderGlobalModal({organization});

      act(() => {
        openModal(
          modalProps => (
            <AggregateColumnEditorModal
              {...modalProps}
              columns={columns}
              onColumnsChange={onColumnsChange}
              stringTags={stringTags}
              numberTags={numberTags}
              booleanTags={booleanTags}
            />
          ),
          {onClose: jest.fn()}
        );
      });
    }

    it('hides the series filter without the feature', async () => {
      renderModal({columns: [new VisualizeFunction('count(span.duration)')]});

      expect(await screen.findByTestId('editor-visualize-function')).toBeInTheDocument();
      expect(
        screen.queryByPlaceholderText(SERIES_FILTER_PLACEHOLDER)
      ).not.toBeInTheDocument();
    });

    it('turns a series filter into an _if aggregate', async () => {
      const onColumnsChange = jest.fn();

      renderModal({
        columns: [
          {groupBy: 'geo.country'},
          new VisualizeFunction('count(span.duration)'),
        ],
        onColumnsChange,
        organization: organizationWithConditionalAggregates,
      });

      const filterInput = await screen.findByPlaceholderText(SERIES_FILTER_PLACEHOLDER);
      await userEvent.click(filterInput);
      await userEvent.paste('span.op:db');
      await userEvent.keyboard('{Enter}');

      await userEvent.click(screen.getByRole('button', {name: 'Apply'}));
      expect(onColumnsChange).toHaveBeenCalledWith([
        {groupBy: 'geo.country'},
        {yAxes: ['count_if(`span.op:db`,span.duration)']},
      ]);
    });

    it('renders an existing _if aggregate as its base aggregate and filter', async () => {
      renderModal({
        columns: [new VisualizeFunction('avg_if(`span.op:db`,span.duration)')],
        organization: organizationWithConditionalAggregates,
      });

      const row = await screen.findByTestId('editor-row');
      expect(within(row).getByTestId('editor-visualize-function')).toHaveTextContent(
        'Functionavg'
      );
      // The filter query is not mistaken for the aggregate's attribute.
      expect(within(row).getByTestId('editor-visualize-argument')).toHaveTextContent(
        'span.duration'
      );
      expect(within(row).getByText('span.op')).toBeInTheDocument();
    });

    it('keeps the filter when the attribute changes', async () => {
      const onColumnsChange = jest.fn();

      renderModal({
        columns: [new VisualizeFunction('avg_if(`span.op:db`,span.duration)')],
        onColumnsChange,
        organization: organizationWithConditionalAggregates,
      });

      const argument = await screen.findByTestId('editor-visualize-argument');
      await userEvent.click(within(argument).getByRole('button'));
      await userEvent.click(await screen.findByRole('option', {name: 'span.self_time'}));

      await userEvent.click(screen.getByRole('button', {name: 'Apply'}));
      expect(onColumnsChange).toHaveBeenCalledWith([
        {yAxes: ['avg_if(`span.op:db`,span.self_time)']},
      ]);
    });

    it('drops the filter when switching to an aggregate that cannot be filtered', async () => {
      const onColumnsChange = jest.fn();

      renderModal({
        columns: [new VisualizeFunction('avg_if(`span.op:db`,span.duration)')],
        onColumnsChange,
        organization: organizationWithConditionalAggregates,
      });

      const func = await screen.findByTestId('editor-visualize-function');
      await userEvent.click(within(func).getByRole('button'));
      await userEvent.click(await screen.findByRole('option', {name: 'epm'}));

      await waitFor(() => {
        expect(
          screen.queryByPlaceholderText(SERIES_FILTER_PLACEHOLDER)
        ).not.toBeInTheDocument();
      });

      await userEvent.click(screen.getByRole('button', {name: 'Apply'}));
      expect(onColumnsChange).toHaveBeenCalledWith([{yAxes: ['epm()']}]);
    });
  });
});

function expectRows(rows: HTMLElement[]) {
  return {
    toHaveAggregateFields(fields: AggregateField[]) {
      expect(rows).toHaveLength(fields.length);

      for (let i = 0; i < fields.length; i++) {
        const row = rows[i]!;
        const field = fields[i]!;
        if (isGroupBy(field)) {
          const groupByElement = within(row).getByTestId('editor-groupby');
          expect(groupByElement).toHaveTextContent(
            new RegExp(`Group By${field.groupBy}`)
          );
        } else {
          const parsedFunction = parseFunction(field.yAxis)!;
          expect(parsedFunction).not.toBeNull();
          expect(parsedFunction.arguments.filter(Boolean)).toHaveLength(1);

          const functionElement = within(row).getByTestId('editor-visualize-function');
          expect(functionElement).toHaveTextContent(
            new RegExp(`Function${parsedFunction.name}`)
          );

          const argsRegexOverride =
            field.yAxis === 'count(span.duration)' ? /spans/ : undefined;
          const argumentElement = within(row).getByTestId('editor-visualize-argument');
          expect(argumentElement).toHaveTextContent(
            argsRegexOverride ?? new RegExp(parsedFunction.arguments[0]!)
          );
        }
      }
    },
  };
}
