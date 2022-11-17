import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import TagStore from 'sentry/stores/tagStore';
import ColumnEditModal from 'sentry/views/eventsV2/table/columnEditModal';

const stubEl = props => <div>{props.children}</div>;

function mountModal({columns, onApply, customMeasurements}, initialData) {
  return render(
    <ColumnEditModal
      Header={stubEl}
      Footer={stubEl}
      Body={stubEl}
      organization={initialData.organization}
      columns={columns}
      onApply={onApply}
      closeModal={() => void 0}
      customMeasurements={customMeasurements}
    />,
    {context: initialData.routerContext}
  );
}

// Get all queryField components which represent a row in the column editor.
const findAllQueryFields = () => screen.findAllByTestId('queryField');

// Get the nth label (value) within the row of the column editor.
const findAllQueryFieldNthCell = async nth =>
  (await findAllQueryFields())
    .map(f => within(f).getAllByTestId('label')[nth])
    .filter(Boolean);

const getAllQueryFields = () => screen.getAllByTestId('queryField');
const getAllQueryFieldsNthCell = nth =>
  getAllQueryFields()
    .map(f => within(f).getAllByTestId('label')[nth])
    .filter(Boolean);

const openMenu = async (row, column = 0) => {
  const queryFields = await screen.findAllByTestId('queryField');
  const queryField = queryFields[row];
  expect(queryField).toBeInTheDocument();

  const labels = within(queryField).queryAllByTestId('label');
  if (labels.length > 0) {
    userEvent.click(labels[column]);
  } else {
    // For test adding a new column, no existing label.
    userEvent.click(screen.getByText('(Required)'));
  }
};

const selectByLabel = async (label, options) => {
  await openMenu(options.at);
  const menuOptions = screen.getAllByTestId('menu-list-item-label'); // TODO: Can likely switch to menuitem role and match against label
  const opt = menuOptions.find(e => e.textContent.includes(label));
  userEvent.click(opt);
};

describe('EventsV2 -> ColumnEditModal', function () {
  beforeEach(() => {
    TagStore.reset();
    TagStore.loadTagsSuccess([
      {name: 'browser.name', key: 'browser.name', count: 1},
      {name: 'custom-field', key: 'custom-field', count: 1},
      {name: 'user', key: 'user', count: 1},
    ]);
  });
  const initialData = initializeOrg({
    organization: {
      features: ['performance-view', 'dashboards-mep'],
    },
  });
  const columns = [
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
      function: ['count', 'id'],
    },
    {
      kind: 'function',
      function: ['count_unique', 'title'],
    },
    {
      kind: 'function',
      function: ['p95', ''],
    },
    {
      kind: 'field',
      field: 'issue.id',
    },
    {
      kind: 'function',
      function: ['count_unique', 'issue.id'],
    },
  ];

  describe('basic rendering', function () {
    it('renders fields and basic controls, delete and grab buttons', async function () {
      mountModal(
        {
          columns,
          onApply: () => void 0,
        },
        initialData
      );
      // Should have fields equal to the columns.
      expect((await findAllQueryFieldNthCell(0)).map(el => el.textContent)).toEqual([
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
            {kind: 'function', function: ['count_unique', 'user-defined']},
            {kind: 'field', field: 'user-def'},
          ],
          onApply: () => void 0,
        },
        initialData
      );

      expect((await findAllQueryFieldNthCell(0)).map(el => el.textContent)).toEqual([
        'count_unique(…)',
        'user-def',
      ]);

      expect(getAllQueryFieldsNthCell(1).map(el => el.textContent)).toEqual([
        'user-defined',
      ]);
    });
  });

  describe('rendering tags that overlap fields & functions', function () {
    beforeEach(() => {
      TagStore.reset();
      TagStore.loadTagsSuccess([
        {name: 'project', key: 'project', count: 1},
        {name: 'count', key: 'count', count: 1},
      ]);
    });

    it('selects tag expressions that overlap fields', async function () {
      mountModal(
        {
          columns: [
            {kind: 'field', field: 'tags[project]'},
            {kind: 'field', field: 'tags[count]'},
          ],
          onApply: () => void 0,
        },
        initialData
      );

      expect((await findAllQueryFieldNthCell(0)).map(el => el.textContent)).toEqual([
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
          onApply: () => void 0,
        },
        initialData
      );

      expect((await findAllQueryFieldNthCell(0)).map(el => el.textContent)).toEqual([
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
            {kind: 'function', function: ['count', 'id']},
            {kind: 'function', function: ['count_unique', 'title']},
            {kind: 'function', function: ['percentile', 'transaction.duration', '0.66']},
          ],
          onApply: () => void 0,
        },
        initialData
      );

      const queryFields = await findAllQueryFields();

      const countRow = queryFields[0];

      expect(
        within(countRow)
          .getAllByTestId('label')
          .map(el => el.textContent)
      ).toEqual(['count()']);

      const percentileRow = queryFields[2];

      expect(
        within(percentileRow)
          .getAllByTestId('label')
          .map(el => el.textContent)
      ).toEqual(['percentile(…)', 'transaction.duration']);
      expect(within(percentileRow).getByDisplayValue('0.66')).toBeInTheDocument();
    });
  });

  describe('function & column selection', function () {
    let onApply;
    beforeEach(function () {
      onApply = jest.fn();
    });

    it('restricts column choices', async function () {
      mountModal(
        {
          columns: [columns[0]],
          onApply,
        },
        initialData
      );
      await selectByLabel('avg(…)', {
        at: 0,
      });

      await openMenu(0, 1);

      const menuOptions = await screen.findAllByTestId('menu-list-item-label');
      const menuOptionsText = menuOptions.map(el => el.textContent);
      expect(menuOptionsText).toContain('transaction.duration');
      expect(menuOptionsText).not.toContain('title');
    });

    it('shows no options for parameterless functions', async function () {
      mountModal(
        {
          columns: [columns[0]],
          onApply,
        },
        initialData
      );
      await selectByLabel('last_seen()', {name: 'field', at: 0, control: true});

      expect(screen.getByTestId('blankSpace')).toBeInTheDocument();
    });

    it('shows additional inputs for multi-parameter functions', async function () {
      mountModal(
        {
          columns: [columns[0]],
          onApply,
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
          columns: [columns[0]],
          onApply,
        },
        initialData
      );
      await selectByLabel('apdex(\u2026)', {
        name: 'field',
        at: 0,
      });

      expect(screen.getAllByRole('textbox')[1]).toHaveValue('300');
      userEvent.click(screen.getByRole('button', {name: 'Apply'}));

      await waitFor(() => {
        expect(onApply).toHaveBeenCalledWith([
          {kind: 'function', function: ['apdex', '300', undefined, undefined]},
        ]);
      });
    });

    it('handles parameter overrides', async function () {
      mountModal(
        {
          columns: [columns[0]],
          onApply,
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
          columns: [columns[0]],
          onApply,
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
      userEvent.click(screen.getByRole('button', {name: 'Apply'}));

      expect(onApply).toHaveBeenCalledWith([
        {kind: 'function', function: ['apdex', '300', undefined, undefined]},
      ]);
    });

    it('clears all unused parameters', async function () {
      mountModal(
        {
          columns: [columns[0]],
          onApply,
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
      userEvent.click(screen.getByRole('button', {name: 'Apply'}));

      expect(onApply).toHaveBeenCalledWith([
        {kind: 'function', function: ['failure_rate', '', undefined, undefined]},
      ]);
    });

    it('clears all unused parameters with count_if to two parameter function', async function () {
      mountModal(
        {
          columns: [columns[0]],
          onApply,
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
      userEvent.click(screen.getByRole('button', {name: 'Apply'}));
      expect(onApply).toHaveBeenCalledWith([
        {kind: 'function', function: ['count_miserable', 'user', '300', undefined]},
      ]);
    });

    it('clears all unused parameters with count_if to one parameter function', async function () {
      mountModal(
        {
          columns: [columns[0]],
          onApply,
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
      userEvent.click(screen.getByRole('button', {name: 'Apply'}));
      expect(onApply).toHaveBeenCalledWith([
        {kind: 'function', function: ['count_unique', '300', undefined, undefined]},
      ]);
    });

    it('clears all unused parameters with count_if to parameterless function', async function () {
      mountModal(
        {
          columns: [columns[0]],
          onApply,
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
      userEvent.click(screen.getByRole('button', {name: 'Apply'}));
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
        },
        initialData
      );

      userEvent.hover(await screen.findByTestId('arithmeticErrorWarning'));
      expect(await screen.findByText('Division by 0 is not allowed')).toBeInTheDocument();

      const input = screen.getAllByRole('textbox')[0];
      expect(input).toHaveValue('1 / 0');

      userEvent.clear(input);
      userEvent.type(input, '1+1+1+1+1+1+1+1+1+1+1+1');
      userEvent.click(document.body);

      await waitFor(() => expect(input).toHaveValue('1+1+1+1+1+1+1+1+1+1+1+1'));

      userEvent.hover(screen.getByTestId('arithmeticErrorWarning'));
      expect(await screen.findByText('Maximum operators exceeded')).toBeInTheDocument();
    });

    it('resets required field to previous value if cleared', function () {
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
        },
        initialData
      );

      const input = screen.getAllByRole('textbox')[2]; // The numeric input
      expect(input).toHaveValue(initialColumnVal);
      userEvent.clear(input);
      userEvent.click(document.body); // Unfocusing the input should revert it to the previous value

      expect(input).toHaveValue(initialColumnVal);

      userEvent.click(screen.getByRole('button', {name: 'Apply'}));
      expect(onApply).toHaveBeenCalledWith([
        {
          kind: 'function',
          function: ['percentile', 'transaction.duration', initialColumnVal, undefined],
        },
      ]);
    });
  });

  describe('equation automatic update', function () {
    let onApply;
    beforeEach(function () {
      onApply = jest.fn();
    });
    it('update simple equation columns when they change', async function () {
      mountModal(
        {
          columns: [
            {
              kind: 'function',
              function: ['count_unique', 'user'],
            },
            {
              kind: 'function',
              function: ['p95', ''],
            },
            {
              kind: 'equation',
              field: '(p95() / count_unique(user)  ) *   100',
            },
          ],
          onApply,
        },
        initialData
      );
      await selectByLabel('count_if(\u2026)', {
        name: 'field',
        at: 0,
      });

      // Apply the changes so we can see the new columns.
      userEvent.click(screen.getByRole('button', {name: 'Apply'}));
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
              function: ['count_unique', 'user'],
            },
            {
              kind: 'equation',
              field:
                'count_unique(user) +  (count_unique(user) - count_unique(user)) * 5',
            },
          ],
          onApply,
        },
        initialData
      );
      await selectByLabel('count()', {
        name: 'field',
        at: 0,
      });

      // Apply the changes so we can see the new columns.
      userEvent.click(screen.getByRole('button', {name: 'Apply'}));
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
        },
        initialData
      );
      await selectByLabel('count()', {
        name: 'field',
        at: 0,
      });

      // Apply the changes so we can see the new columns.
      userEvent.click(screen.getByRole('button', {name: 'Apply'}));
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
        },
        initialData
      );
      await selectByLabel('count_unique(\u2026)', {
        name: 'field',
        at: 0,
      });

      // Apply the changes so we can see the new columns.
      userEvent.click(screen.getByRole('button', {name: 'Apply'}));
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
        },
        initialData
      );
      expect(await screen.findByTestId('arithmeticErrorWarning')).toBeInTheDocument();
      await selectByLabel('count_unique(\u2026)', {
        name: 'field',
        at: 0,
      });

      // Apply the changes so we can see the new columns.
      userEvent.click(screen.getByRole('button', {name: 'Apply'}));
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
    it('allows rows to be added, but only up to 20', async function () {
      mountModal(
        {
          columns: [columns[0]],
          onApply: () => void 0,
        },
        initialData
      );
      expect(await screen.findByTestId('queryField')).toBeInTheDocument();
      for (let i = 2; i <= 20; i++) {
        userEvent.click(screen.getByRole('button', {name: 'Add a Column'}));
        expect(await screen.findAllByTestId('queryField')).toHaveLength(i);
      }

      expect(screen.getByRole('button', {name: 'Add a Column'})).toBeDisabled();
    });
  });

  describe('removing rows', function () {
    it('allows rows to be removed, but not the last one', async function () {
      mountModal(
        {
          columns: [columns[0], columns[1]],
          onApply: () => void 0,
        },
        initialData
      );

      expect(await screen.findAllByTestId('queryField')).toHaveLength(2);
      userEvent.click(screen.getByTestId('remove-column-0'));

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
            columns[0],
            columns[1],
            {
              kind: 'equation',
              field: '5 + 5',
            },
          ],
          onApply: () => void 0,
        },
        initialData
      );
      expect(await screen.findAllByTestId('queryField')).toHaveLength(3);
      userEvent.click(screen.getByTestId('remove-column-0'));

      expect(await screen.findAllByTestId('queryField')).toHaveLength(2);

      expect(screen.queryByRole('button', {name: 'Remove column'})).toBeInTheDocument();
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
            columns[0],
            columns[1],
          ],
          onApply: () => void 0,
        },
        initialData
      );
      expect(await screen.findAllByTestId('queryField')).toHaveLength(3);
      expect(screen.getByTestId('arithmeticErrorWarning')).toBeInTheDocument();

      userEvent.click(screen.getByTestId('remove-column-0'));

      expect(await screen.findAllByTestId('queryField')).toHaveLength(2);

      expect(screen.queryByTestId('arithmeticErrorWarning')).not.toBeInTheDocument();
    });
  });

  describe('apply action', function () {
    const onApply = jest.fn();
    it('reflects added and removed columns', async function () {
      mountModal(
        {
          columns: [columns[0], columns[1]],
          onApply,
        },
        initialData
      );
      expect(await screen.findAllByTestId('queryField')).toHaveLength(2);
      // Remove a column, then add a blank one an select a value in it.
      userEvent.click(screen.getByTestId('remove-column-0'));

      userEvent.click(screen.getByRole('button', {name: 'Add a Column'}));

      expect(await screen.findAllByTestId('queryField')).toHaveLength(2);

      await selectByLabel('title', {name: 'field', at: 1});

      userEvent.click(screen.getByRole('button', {name: 'Apply'}));

      expect(onApply).toHaveBeenCalledWith([columns[1], {kind: 'field', field: 'title'}]);
    });
  });

  describe('custom performance metrics', function () {
    it('allows selecting custom performance metrics in dropdown', function () {
      render(
        <ColumnEditModal
          Header={stubEl}
          Footer={stubEl}
          Body={stubEl}
          organization={initialData.organization}
          columns={[columns[0]]}
          onApply={() => undefined}
          closeModal={() => undefined}
          customMeasurements={{
            'measurements.custom.kibibyte': {
              key: 'measurements.custom.kibibyte',
              name: 'measurements.custom.kibibyte',
              functions: ['p99'],
            },
            'measurements.custom.minute': {
              key: 'measurements.custom.minute',
              name: 'measurements.custom.minute',
              functions: ['p99'],
            },
            'measurements.custom.ratio': {
              key: 'measurements.custom.ratio',
              name: 'measurements.custom.ratio',
              functions: ['p99'],
            },
          }}
        />
      );
      expect(screen.getByText('event.type')).toBeInTheDocument();
      userEvent.click(screen.getByText('event.type'));
      userEvent.type(screen.getAllByText('event.type')[0], 'custom');
      expect(screen.getByText('measurements.custom.kibibyte')).toBeInTheDocument();
    });
  });
});
