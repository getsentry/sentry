import styled from '@emotion/styled';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  fireEvent,
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import {makeCloseButton} from 'sentry/components/globalModal/components';
import TagStore from 'sentry/stores/tagStore';
import type {QueryFieldValue} from 'sentry/utils/discover/fields';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import ColumnEditModal from 'sentry/views/discover/table/columnEditModal';

const stubEl = styled((p: any) => p.children);

function mountModal(
  {
    columns,
    onApply,
    customMeasurements,
    dataset,
  }: Pick<
    React.ComponentProps<typeof ColumnEditModal>,
    'columns' | 'onApply' | 'customMeasurements' | 'dataset'
  >,
  initialData: ReturnType<typeof initializeOrg>
) {
  return render(
    <ColumnEditModal
      CloseButton={makeCloseButton(() => {})}
      Header={c => <div>{c.children}</div>}
      Footer={stubEl()}
      Body={stubEl()}
      organization={initialData.organization}
      columns={columns}
      onApply={onApply}
      closeModal={jest.fn()}
      measurementKeys={null}
      customMeasurements={customMeasurements}
      dataset={dataset}
    />,
    {router: initialData.router}
  );
}

// Get all queryField components which represent a row in the column editor.
const findAllQueryFields = () => screen.findAllByTestId('queryField');

// Get the nth label (value) within the row of the column editor.
const findAllQueryFieldNthCell = async (nth: number) =>
  (await findAllQueryFields())
    .map(f => within(f).getAllByTestId('label')[nth])
    .filter(Boolean);

const getAllQueryFields = () => screen.getAllByTestId('queryField');
const getAllQueryFieldsNthCell = (nth: number) =>
  getAllQueryFields()
    .map(f => within(f).getAllByTestId('label')[nth])
    .filter(Boolean);

const openMenu = async (row: number, column = 0) => {
  const queryFields = await screen.findAllByTestId('queryField');
  const queryField = queryFields[row]!;
  expect(queryField).toBeInTheDocument();

  const labels = within(queryField).queryAllByTestId('label');
  if (labels.length > 0) {
    await userEvent.click(labels[column]!);
  } else {
    // For test adding a new column, no existing label.
    await userEvent.click(screen.getByText('(Required)'));
  }
};

const selectByLabel = async (
  label: string,
  options: {at: number; control?: boolean; name?: string}
) => {
  await openMenu(options.at);
  const menuOptions = screen.getAllByTestId('menu-list-item-label'); // TODO: Can likely switch to menuitem role and match against label
  const opt = menuOptions.find(e => e.textContent?.includes(label));
  await userEvent.click(opt!);
};

describe('Discover -> ColumnEditModal', function () {
  beforeEach(() => {
    TagStore.reset();
    TagStore.loadTagsSuccess([
      {name: 'browser.name', key: 'browser.name'},
      {name: 'custom-field', key: 'custom-field'},
      {name: 'user', key: 'user'},
    ]);
  });
  const initialData = initializeOrg({
    organization: {
      features: ['performance-view', 'dashboards-mep'],
    },
  });
  const columns: QueryFieldValue[] = [
    {
      kind: 'field',
      field: 'event.type',
    },
    {
      kind: 'field',
      field: 'browser.name',
    },
    {
      kind: 'function',
      function: ['count', 'id', '', ''],
    },
    {
      kind: 'function',
      function: ['count_unique', 'title', '', ''],
    },
    {
      kind: 'function',
      function: ['p95', '', '', ''],
    },
    {
      kind: 'field',
      field: 'issue.id',
    },
    {
      kind: 'function',
      function: ['count_unique', 'issue.id', '', ''],
    },
  ];

  describe('basic rendering', function () {
    it('renders fields and basic controls, async delete and grab buttons', async function () {
      mountModal(
        {
          columns,
          onApply: jest.fn(),
          customMeasurements: {},
        },
        initialData
      );
      // Should have fields equal to the columns.
      expect((await findAllQueryFieldNthCell(0)).map(el => el!.textContent)).toEqual([
        'event.type',
        'browser.name',
        'count()',
        'count_unique(…)',
        'p95(…)',
        'issue.id',
        'count_unique(…)', // extra because of the function
      ]);
      expect(screen.getByRole('button', {name: 'Apply'})).toBeInTheDocument();
      expect(screen.getByRole('button', {name: 'Add a Column'})).toBeInTheDocument();

      expect(screen.getAllByRole('button', {name: 'Remove column'})).toHaveLength(
        columns.length
      );
      expect(screen.getAllByRole('button', {name: 'Drag to reorder'})).toHaveLength(
        columns.length
      );
    });
  });

  describe('rendering unknown fields', function () {
    it('renders unknown fields in field and field parameter controls', async function () {
      mountModal(
        {
          columns: [
            {
              kind: 'function',
              function: ['count_unique', 'user-defined', undefined, undefined],
            },
            {kind: 'field', field: 'user-def'},
          ],
          onApply: jest.fn(),
          customMeasurements: {},
        },
        initialData
      );

      expect((await findAllQueryFieldNthCell(0)).map(el => el!.textContent)).toEqual([
        'count_unique(…)',
        'user-def',
      ]);

      expect(getAllQueryFieldsNthCell(1).map(el => el!.textContent)).toEqual([
        'user-defined',
      ]);
    });
  });

  describe('rendering tags that overlap fields & functions', function () {
    beforeEach(() => {
      TagStore.reset();
      TagStore.loadTagsSuccess([
        {name: 'project', key: 'project'},
        {name: 'count', key: 'count'},
      ]);
    });

    it('selects tag expressions that overlap fields', async function () {
      mountModal(
        {
          columns: [
            {kind: 'field', field: 'tags[project]'},
            {kind: 'field', field: 'tags[count]'},
          ],
          onApply: jest.fn(),
          customMeasurements: {},
        },
        initialData
      );

      expect((await findAllQueryFieldNthCell(0)).map(el => el!.textContent)).toEqual([
        'project',
        'count',
      ]);
    });

    it('selects tag expressions that overlap functions', async function () {
      mountModal(
        {
          columns: [
            {kind: 'field', field: 'tags[project]'},
            {kind: 'field', field: 'tags[count]'},
          ],
          onApply: jest.fn(),
          customMeasurements: {},
        },
        initialData
      );

      expect((await findAllQueryFieldNthCell(0)).map(el => el!.textContent)).toEqual([
        'project',
        'count',
      ]);
    });
  });

  describe('rendering functions', function () {
    it('renders three columns when needed', async function () {
      mountModal(
        {
          columns: [
            {kind: 'function', function: ['count', 'id', undefined, undefined]},
            {kind: 'function', function: ['count_unique', 'title', undefined, undefined]},
            {
              kind: 'function',
              function: ['percentile', 'transaction.duration', '0.66', undefined],
            },
          ],
          onApply: jest.fn(),
          customMeasurements: {},
        },
        initialData
      );

      const queryFields = await findAllQueryFields();

      const countRow = queryFields[0]!;

      expect(
        within(countRow)
          .getAllByTestId('label')
          .map(el => el!.textContent)
      ).toEqual(['count()']);

      const percentileRow = queryFields[2]!;

      expect(
        within(percentileRow)
          .getAllByTestId('label')
          .map(el => el!.textContent)
      ).toEqual(['percentile(…)', 'transaction.duration']);
      expect(within(percentileRow).getByDisplayValue('0.66')).toBeInTheDocument();
    });
  });

  describe('function & column selection', function () {
    let onApply!: jest.Mock;
    beforeEach(function () {
      onApply = jest.fn();
    });

    it('restricts column choices', async function () {
      mountModal(
        {
          columns: [columns[0]!],
          onApply,
          customMeasurements: {},
        },
        initialData
      );
      await selectByLabel('avg(…)', {
        at: 0,
      });

      await openMenu(0, 1);

      const menuOptions = await screen.findAllByTestId('menu-list-item-label');
      const menuOptionsText = menuOptions.map(el => el!.textContent);
      expect(menuOptionsText).toContain('transaction.duration');
      expect(menuOptionsText).not.toContain('title');
    });

    it('shows no options for parameterless functions', async function () {
      mountModal(
        {
          columns: [columns[0]!],
          onApply,
          customMeasurements: {},
        },
        initialData
      );
      await selectByLabel('last_seen()', {name: 'field', at: 0, control: true});

      expect(screen.getByTestId('blankSpace')).toBeInTheDocument();
    });

    it('shows additional inputs for multi-parameter functions', async function () {
      mountModal(
        {
          columns: [columns[0]!],
          onApply,
          customMeasurements: {},
        },
        initialData
      );
      await selectByLabel('percentile(\u2026)', {
        name: 'field',
        at: 0,
      });

      expect(screen.getAllByTestId('label')[0]).toHaveTextContent('percentile(…)');
      expect(
        within(screen.getByTestId('queryField')).getByDisplayValue(0.5)
      ).toBeInTheDocument();
    });

    it('handles scalar field parameters', async function () {
      mountModal(
        {
          columns: [columns[0]!],
          onApply,
          customMeasurements: {},
        },
        initialData
      );
      await selectByLabel('apdex(\u2026)', {
        name: 'field',
        at: 0,
      });

      expect(screen.getAllByRole('textbox')[1]).toHaveValue('300');
      await userEvent.click(screen.getByRole('button', {name: 'Apply'}));

      await waitFor(() => {
        expect(onApply).toHaveBeenCalledWith([
          {kind: 'function', function: ['apdex', '300', undefined, undefined]},
        ]);
      });
    });

    it('handles parameter overrides', async function () {
      mountModal(
        {
          columns: [columns[0]!],
          onApply,
          customMeasurements: {},
        },
        initialData
      );
      await selectByLabel('apdex(…)', {
        name: 'field',
        at: 0,
      });

      expect(screen.getAllByRole('textbox')[1]).toHaveValue('300');
    });

    it('clears unused parameters', async function () {
      mountModal(
        {
          columns: [columns[0]!],
          onApply,
          customMeasurements: {},
        },
        initialData
      );
      // Choose percentile, then apdex which has fewer parameters and different types.
      await selectByLabel('percentile(\u2026)', {
        name: 'field',
        at: 0,
      });
      await selectByLabel('apdex(\u2026)', {
        name: 'field',
        at: 0,
      });

      // Apply the changes so we can see the new columns.
      await userEvent.click(screen.getByRole('button', {name: 'Apply'}));

      expect(onApply).toHaveBeenCalledWith([
        {kind: 'function', function: ['apdex', '300', undefined, undefined]},
      ]);
    });

    it('clears all unused parameters', async function () {
      mountModal(
        {
          columns: [columns[0]!],
          onApply,
          customMeasurements: {},
        },
        initialData
      );
      // Choose percentile, then failure_rate which has no parameters.
      await selectByLabel('percentile(\u2026)', {
        name: 'field',
        at: 0,
      });
      await selectByLabel('failure_rate()', {
        name: 'field',
        at: 0,
      });

      // Apply the changes so we can see the new columns.
      await userEvent.click(screen.getByRole('button', {name: 'Apply'}));

      expect(onApply).toHaveBeenCalledWith([
        {kind: 'function', function: ['failure_rate', '', undefined, undefined]},
      ]);
    });

    it('clears all unused parameters with count_if to two parameter function', async function () {
      mountModal(
        {
          columns: [columns[0]!],
          onApply,
          customMeasurements: {},
        },
        initialData
      );
      // Choose percentile, then failure_rate which has no parameters.
      await selectByLabel('count_if(\u2026)', {
        name: 'field',
        at: 0,
      });
      await selectByLabel('user', {name: 'parameter', at: 0});
      await selectByLabel('count_miserable(\u2026)', {
        name: 'field',
        at: 0,
      });

      // Apply the changes so we can see the new columns.
      await userEvent.click(screen.getByRole('button', {name: 'Apply'}));
      expect(onApply).toHaveBeenCalledWith([
        {kind: 'function', function: ['count_miserable', 'user', '300', undefined]},
      ]);
    });

    it('clears all unused parameters with count_if to one parameter function', async function () {
      mountModal(
        {
          columns: [columns[0]!],
          onApply,
          customMeasurements: {},
        },
        initialData
      );
      // Choose percentile, then failure_rate which has no parameters.
      await selectByLabel('count_if(\u2026)', {
        name: 'field',
        at: 0,
      });
      await selectByLabel('user', {name: 'parameter', at: 0});
      await selectByLabel('count_unique(\u2026)', {
        name: 'field',
        at: 0,
      });

      // Apply the changes so we can see the new columns.
      await userEvent.click(screen.getByRole('button', {name: 'Apply'}));
      expect(onApply).toHaveBeenCalledWith([
        {kind: 'function', function: ['count_unique', '300', undefined, undefined]},
      ]);
    });

    it('clears all unused parameters with count_if to parameterless function', async function () {
      mountModal(
        {
          columns: [columns[0]!],
          onApply,
          customMeasurements: {},
        },
        initialData
      );
      // Choose percentile, then failure_rate which has no parameters.
      await selectByLabel('count_if(\u2026)', {
        name: 'field',
        at: 0,
      });
      await selectByLabel('count()', {
        name: 'field',
        at: 0,
      });

      // Apply the changes so we can see the new columns.
      await userEvent.click(screen.getByRole('button', {name: 'Apply'}));
      expect(onApply).toHaveBeenCalledWith([
        {kind: 'function', function: ['count', '', undefined, undefined]},
      ]);
    });

    it('updates equation errors when they change', async function () {
      mountModal(
        {
          columns: [
            {
              kind: 'equation',
              field: '1 / 0',
            },
          ],
          onApply,
          customMeasurements: {},
        },
        initialData
      );

      await userEvent.hover(await screen.findByTestId('arithmeticErrorWarning'));
      expect(await screen.findByText('Division by 0 is not allowed')).toBeInTheDocument();

      const input = screen.getAllByRole('textbox')[0]!;
      expect(input).toHaveValue('1 / 0');

      await userEvent.clear(input);
      await userEvent.type(input, '1+1+1+1+1+1+1+1+1+1+1+1');
      await userEvent.click(document.body);

      await waitFor(() => expect(input).toHaveValue('1+1+1+1+1+1+1+1+1+1+1+1'));

      await userEvent.hover(screen.getByTestId('arithmeticErrorWarning'));
      expect(await screen.findByText('Maximum operators exceeded')).toBeInTheDocument();
    });

    it('resets required field to previous value if cleared', async function () {
      const initialColumnVal = '0.6';
      mountModal(
        {
          columns: [
            {
              kind: 'function',
              function: [
                'percentile',
                'transaction.duration',
                initialColumnVal,
                undefined,
              ],
            },
          ],
          onApply,
          customMeasurements: {},
        },
        initialData
      );

      const input = screen.getAllByRole('textbox')[2]!; // The numeric input
      expect(input).toHaveValue(initialColumnVal);
      await userEvent.clear(input);
      await userEvent.click(document.body); // Unfocusing the input should revert it to the previous value

      expect(input).toHaveValue(initialColumnVal);

      await userEvent.click(screen.getByRole('button', {name: 'Apply'}));
      expect(onApply).toHaveBeenCalledWith([
        {
          kind: 'function',
          function: ['percentile', 'transaction.duration', initialColumnVal, undefined],
        },
      ]);
    });

    it('chooses the correct default parameters for the errors dataset', async function () {
      mountModal(
        {
          columns: [
            {
              kind: 'function',
              function: ['count', '', undefined, undefined],
            },
          ],
          onApply,
          customMeasurements: {},
          dataset: DiscoverDatasets.ERRORS,
        },
        initialData
      );

      expect(await screen.findByText('count()')).toBeInTheDocument();

      await userEvent.click(screen.getByText('count()'));
      await userEvent.click(screen.getByText(/count_if/));

      expect(screen.getByText('event.type')).toBeInTheDocument();
      expect(screen.getByDisplayValue('error')).toBeInTheDocument();
    });

    it('chooses the correct default count_if parameters for the transactions dataset', async function () {
      mountModal(
        {
          columns: [
            {
              kind: 'function',
              function: ['count', '', undefined, undefined],
            },
          ],
          onApply,
          customMeasurements: {},
          dataset: DiscoverDatasets.TRANSACTIONS,
        },
        initialData
      );

      expect(await screen.findByText('count()')).toBeInTheDocument();

      await userEvent.click(screen.getByText('count()'));
      await userEvent.click(screen.getByText(/count_if/));

      expect(screen.getByText('transaction.duration')).toBeInTheDocument();
      expect(screen.getByDisplayValue('300')).toBeInTheDocument();
    });
  });

  describe('equation automatic update', function () {
    let onApply!: jest.Mock;
    beforeEach(function () {
      onApply = jest.fn();
    });
    it('update simple equation columns when they change', async function () {
      mountModal(
        {
          columns: [
            {
              kind: 'function',
              function: ['count_unique', 'user', undefined, undefined],
            },
            {
              kind: 'function',
              function: ['p95', '', undefined, undefined],
            },
            {
              kind: 'equation',
              field: '(p95() / count_unique(user)  ) *   100',
            },
          ],
          onApply,
          customMeasurements: {},
        },
        initialData
      );
      await selectByLabel('count_if(\u2026)', {
        name: 'field',
        at: 0,
      });

      // Apply the changes so we can see the new columns.
      await userEvent.click(screen.getByRole('button', {name: 'Apply'}));
      expect(onApply).toHaveBeenCalledWith([
        {kind: 'function', function: ['count_if', 'user', 'equals', '300']},
        {kind: 'function', function: ['p95', '']},
        {kind: 'equation', field: '(p95() / count_if(user,equals,300)  ) *   100'},
      ]);
    });
    it('update equation with repeated columns when they change', async function () {
      mountModal(
        {
          columns: [
            {
              kind: 'function',
              function: ['count_unique', 'user', undefined, undefined],
            },
            {
              kind: 'equation',
              field:
                'count_unique(user) +  (count_unique(user) - count_unique(user)) * 5',
            },
          ],
          onApply,
          customMeasurements: {},
        },
        initialData
      );
      await selectByLabel('count()', {
        name: 'field',
        at: 0,
      });

      // Apply the changes so we can see the new columns.
      await userEvent.click(screen.getByRole('button', {name: 'Apply'}));
      expect(onApply).toHaveBeenCalledWith([
        {kind: 'function', function: ['count', '', undefined, undefined]},
        {kind: 'equation', field: 'count() +  (count() - count()) * 5'},
      ]);
    });
    it('handles equations with duplicate fields', async function () {
      mountModal(
        {
          columns: [
            {
              kind: 'field',
              field: 'spans.db',
            },
            {
              kind: 'field',
              field: 'spans.db',
            },
            {
              kind: 'equation',
              field: 'spans.db - spans.db',
            },
          ],
          onApply,
          customMeasurements: {},
        },
        initialData
      );
      await selectByLabel('count()', {
        name: 'field',
        at: 0,
      });

      // Apply the changes so we can see the new columns.
      await userEvent.click(screen.getByRole('button', {name: 'Apply'}));
      // Because spans.db is still a selected column it isn't swapped
      expect(onApply).toHaveBeenCalledWith([
        {kind: 'function', function: ['count', '', undefined, undefined]},
        {kind: 'field', field: 'spans.db'},
        {kind: 'equation', field: 'spans.db - spans.db'},
      ]);
    });
    it('handles equations with duplicate functions', async function () {
      mountModal(
        {
          columns: [
            {
              kind: 'function',
              function: ['count', '', undefined, undefined],
            },
            {
              kind: 'function',
              function: ['count', '', undefined, undefined],
            },
            {
              kind: 'equation',
              field: 'count() - count()',
            },
          ],
          onApply,
          customMeasurements: {},
        },
        initialData
      );
      await selectByLabel('count_unique(\u2026)', {
        name: 'field',
        at: 0,
      });

      // Apply the changes so we can see the new columns.
      await userEvent.click(screen.getByRole('button', {name: 'Apply'}));
      expect(onApply).toHaveBeenCalledWith([
        {kind: 'function', function: ['count_unique', 'user', undefined, undefined]},
        {kind: 'function', function: ['count', '', undefined, undefined]},
        {kind: 'equation', field: 'count() - count()'},
      ]);
    });
    it('handles incomplete equations', async function () {
      mountModal(
        {
          columns: [
            {
              kind: 'function',
              function: ['count', '', undefined, undefined],
            },
            {
              kind: 'equation',
              field: 'count() - count() arst count() ',
            },
          ],
          onApply,
          customMeasurements: {},
        },
        initialData
      );
      expect(await screen.findByTestId('arithmeticErrorWarning')).toBeInTheDocument();
      await selectByLabel('count_unique(\u2026)', {
        name: 'field',
        at: 0,
      });

      // Apply the changes so we can see the new columns.
      await userEvent.click(screen.getByRole('button', {name: 'Apply'}));
      // With the way the parser works only tokens up to the error will be updated
      expect(onApply).toHaveBeenCalledWith([
        {kind: 'function', function: ['count_unique', 'user', undefined, undefined]},
        {
          kind: 'equation',
          field: 'count_unique(user) - count_unique(user) arst count() ',
        },
      ]);
    });
  });

  describe('adding rows', function () {
    it('allows rows to be added, async but only up to 20', async function () {
      mountModal(
        {
          columns: [columns[0]!],
          onApply: jest.fn(),
          customMeasurements: {},
        },
        initialData
      );
      expect(await screen.findByTestId('queryField')).toBeInTheDocument();
      const addColumnButton = screen.getByRole('button', {name: 'Add a Column'});
      for (let i = 2; i <= 20; i++) {
        fireEvent.click(addColumnButton);
        expect(await screen.findAllByTestId('queryField')).toHaveLength(i);
      }

      expect(screen.getByRole('button', {name: 'Add a Column'})).toBeDisabled();
    });
  });

  describe('removing rows', function () {
    it('allows rows to be removed, async but not the last one', async function () {
      mountModal(
        {
          columns: [columns[0]!, columns[1]!],
          onApply: jest.fn(),
          customMeasurements: {},
        },
        initialData
      );

      expect(await screen.findAllByTestId('queryField')).toHaveLength(2);
      await userEvent.click(screen.getByTestId('remove-column-0'));

      expect(await screen.findByTestId('queryField')).toBeInTheDocument();

      expect(
        screen.queryByRole('button', {name: 'Remove column'})
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', {name: 'Drag to reorder'})
      ).not.toBeInTheDocument();
    });
    it('does not count equations towards the count of rows', async function () {
      mountModal(
        {
          columns: [
            columns[0]!,
            columns[1]!,
            {
              kind: 'equation',
              field: '5 + 5',
            },
          ],
          onApply: jest.fn(),
          customMeasurements: {},
        },
        initialData
      );
      expect(await screen.findAllByTestId('queryField')).toHaveLength(3);
      await userEvent.click(screen.getByTestId('remove-column-0'));

      expect(await screen.findAllByTestId('queryField')).toHaveLength(2);

      expect(screen.getByRole('button', {name: 'Remove column'})).toBeInTheDocument();
      expect(screen.queryAllByRole('button', {name: 'Drag to reorder'})).toHaveLength(2);
    });
    it('handles equations being deleted', async function () {
      mountModal(
        {
          columns: [
            {
              kind: 'equation',
              field: '1 / 0',
            },
            columns[0]!,
            columns[1]!,
          ],
          onApply: jest.fn(),
          customMeasurements: {},
        },
        initialData
      );
      expect(await screen.findAllByTestId('queryField')).toHaveLength(3);
      expect(screen.getByTestId('arithmeticErrorWarning')).toBeInTheDocument();

      await userEvent.click(screen.getByTestId('remove-column-0'));

      expect(await screen.findAllByTestId('queryField')).toHaveLength(2);

      expect(screen.queryByTestId('arithmeticErrorWarning')).not.toBeInTheDocument();
    });
  });

  describe('apply action', function () {
    const onApply = jest.fn();
    it('reflects added and removed columns', async function () {
      mountModal(
        {
          columns: [columns[0]!, columns[1]!],
          onApply,
          customMeasurements: {},
        },
        initialData
      );
      expect(await screen.findAllByTestId('queryField')).toHaveLength(2);
      // Remove a column, then add a blank one an select a value in it.
      await userEvent.click(screen.getByTestId('remove-column-0'));

      await userEvent.click(screen.getByRole('button', {name: 'Add a Column'}));

      expect(await screen.findAllByTestId('queryField')).toHaveLength(2);

      await selectByLabel('title', {name: 'field', at: 1});

      await userEvent.click(screen.getByRole('button', {name: 'Apply'}));

      expect(onApply).toHaveBeenCalledWith([columns[1], {kind: 'field', field: 'title'}]);
    });
  });

  describe('custom performance metrics', function () {
    it('allows selecting custom performance metrics in dropdown', async function () {
      render(
        <ColumnEditModal
          CloseButton={makeCloseButton(() => {})}
          Header={c => <div>{c.children}</div>}
          Footer={stubEl()}
          Body={stubEl()}
          organization={initialData.organization}
          columns={[columns[0]!]}
          onApply={() => undefined}
          closeModal={() => undefined}
          measurementKeys={[]}
          customMeasurements={{
            'measurements.custom.kibibyte': {
              fieldType: 'number',
              unit: 'KiB',
              key: 'measurements.custom.kibibyte',
              name: 'measurements.custom.kibibyte',
              functions: ['p99'],
            },
            'measurements.custom.minute': {
              fieldType: 'number',
              key: 'measurements.custom.minute',
              name: 'measurements.custom.minute',
              unit: 'minute',
              functions: ['p99'],
            },
            'measurements.custom.ratio': {
              fieldType: 'number',
              key: 'measurements.custom.ratio',
              name: 'measurements.custom.ratio',
              unit: 'ratio',
              functions: ['p99'],
            },
          }}
        />
      );
      expect(screen.getByText('event.type')).toBeInTheDocument();
      await userEvent.click(screen.getByText('event.type'));
      await userEvent.type(screen.getAllByText('event.type')[0]!, 'custom');
      expect(screen.getByText('measurements.custom.kibibyte')).toBeInTheDocument();
    });
  });
});
