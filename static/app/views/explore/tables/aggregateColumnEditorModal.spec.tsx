import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  act,
  renderGlobalModal,
  screen,
  userEvent,
  within,
} from 'sentry-test/reactTestingLibrary';

import {openModal} from 'sentry/actionCreators/modal';
import type {TagCollection} from 'sentry/types/group';
import {parseFunction} from 'sentry/utils/discover/fields';
import {FieldKind} from 'sentry/utils/fields';
import {isGroupBy} from 'sentry/views/explore/contexts/pageParamsContext/aggregateFields';
import {DEFAULT_VISUALIZATION} from 'sentry/views/explore/contexts/pageParamsContext/visualizes';
import type {AggregateField} from 'sentry/views/explore/queryParams/aggregateField';
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

describe('AggregateColumnEditorModal', () => {
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
      'foo',
      'geo.city',
      'geo.country',
      'project',
      'span.duration',
      'span.op',
      'span.self_time',
    ];

    const row = screen.getAllByTestId('editor-row')[0]!;

    await userEvent.click(
      within(row).getByRole('button', {name: 'Group By geo.country'})
    );
    const groupByOptions = await screen.findAllByRole('option');
    groupByOptions.forEach((option, i) => {
      expect(option).toHaveTextContent(options[i]!);
    });

    await userEvent.click(groupByOptions[2]!);
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
    const {organization} = initializeOrg({
      organization: {
        features: ['visibility-explore-equations'],
      },
    });

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
