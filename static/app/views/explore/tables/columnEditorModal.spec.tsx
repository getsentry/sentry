import {
  act,
  renderGlobalModal,
  screen,
  userEvent,
  within,
} from 'sentry-test/reactTestingLibrary';

import {openModal} from 'sentry/actionCreators/modal';
import type {TagCollection} from 'sentry/types/group';
import {FieldKind, FieldValueType} from 'sentry/utils/fields';
import {ColumnEditorModal} from 'sentry/views/explore/tables/columnEditorModal';

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
};

const numberTags: TagCollection = {
  'span.duration': {
    key: 'span.duration',
    name: 'span.duration',
    kind: FieldKind.MEASUREMENT,
  },
};

const booleanTags: TagCollection = {
  'span.is_segment': {
    key: 'span.is_segment',
    name: 'span.is_segment',
    kind: FieldKind.BOOLEAN,
  },
  exclusive_time_lost: {
    key: 'exclusive_time_lost',
    name: 'exclusive_time_lost',
    kind: FieldKind.BOOLEAN,
  },
};

const enrichedNumberTags: TagCollection = {
  ...numberTags,
  'custom.duration': {
    key: 'custom.duration',
    name: 'custom.duration',
    kind: FieldKind.MEASUREMENT,
  },
};

const enrichedBooleanTags: TagCollection = {
  ...booleanTags,
  'custom.enabled': {
    key: 'custom.enabled',
    name: 'custom.enabled',
    kind: FieldKind.BOOLEAN,
  },
};

describe('ColumnEditorModal', () => {
  it('allows closes modal on apply', async () => {
    const onClose = jest.fn();

    renderGlobalModal();

    act(() => {
      openModal(
        modalProps => (
          <ColumnEditorModal
            {...modalProps}
            columns={['id', 'project']}
            onColumnsChange={() => {}}
            stringTags={stringTags}
            numberTags={numberTags}
            booleanTags={{}}
          />
        ),
        {onClose}
      );
    });

    expect(onClose).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', {name: 'Apply'}));
    expect(onClose).toHaveBeenCalled();
  });

  it('allows deleting a column', async () => {
    const onColumnsChange = jest.fn();

    renderGlobalModal();

    act(() => {
      openModal(
        modalProps => (
          <ColumnEditorModal
            {...modalProps}
            columns={['id', 'project']}
            onColumnsChange={onColumnsChange}
            stringTags={stringTags}
            numberTags={numberTags}
            booleanTags={{}}
          />
        ),
        {onClose: jest.fn()}
      );
    });

    const columns1 = ['id', 'project'];
    screen.getAllByTestId('editor-column').forEach((column, i) => {
      expect(column).toHaveTextContent(columns1[i]!);
    });

    await userEvent.click(screen.getAllByLabelText('Remove Column')[0]!);

    const columns2 = ['project'];
    screen.getAllByTestId('editor-column').forEach((column, i) => {
      expect(column).toHaveTextContent(columns2[i]!);
    });

    // only 1 column remaining, disable the delete option
    expect(screen.getByLabelText('Remove Column')).toBeDisabled();

    await userEvent.click(screen.getByRole('button', {name: 'Apply'}));
    expect(onColumnsChange).toHaveBeenCalledWith(['project']);
  });

  it('disables editing, removing, and reordering required columns', async () => {
    renderGlobalModal();

    act(() => {
      openModal(
        modalProps => (
          <ColumnEditorModal
            {...modalProps}
            columns={['id', 'project']}
            onColumnsChange={() => {}}
            stringTags={stringTags}
            numberTags={numberTags}
            booleanTags={{}}
            requiredTags={['id']}
          />
        ),
        {onClose: jest.fn()}
      );
    });

    expect(await screen.findByRole('button', {name: 'Apply'})).toBeInTheDocument();

    const [idColumn, projectColumn] = screen.getAllByTestId('editor-column');
    const idRow = within(idColumn!.parentElement!);
    const projectRow = within(projectColumn!.parentElement!);

    expect(idRow.getByRole('button', {name: 'Column id string'})).toBeDisabled();
    expect(idRow.getByRole('button', {name: 'Remove Column'})).toBeDisabled();
    expect(idRow.getByRole('button', {name: 'Drag to reorder'})).toBeDisabled();

    expect(projectRow.getByRole('button', {name: 'Column project string'})).toBeEnabled();
    expect(projectRow.getByRole('button', {name: 'Remove Column'})).toBeEnabled();
    expect(projectRow.getByRole('button', {name: 'Drag to reorder'})).toBeEnabled();
  });

  it('handles duplicate columns without collapsing rows', async () => {
    const onColumnsChange = jest.fn();

    renderGlobalModal();

    act(() => {
      openModal(
        modalProps => (
          <ColumnEditorModal
            {...modalProps}
            columns={['id', 'id', 'project']}
            onColumnsChange={onColumnsChange}
            stringTags={stringTags}
            numberTags={numberTags}
            booleanTags={{}}
          />
        ),
        {onClose: jest.fn()}
      );
    });

    let columns = screen.getAllByTestId('editor-column');
    expect(columns).toHaveLength(3);
    expect(columns[0]).toHaveTextContent('id');
    expect(columns[1]).toHaveTextContent('id');
    expect(columns[2]).toHaveTextContent('project');

    await userEvent.click(screen.getAllByLabelText('Remove Column')[1]!);

    columns = screen.getAllByTestId('editor-column');
    expect(columns).toHaveLength(2);
    expect(columns[0]).toHaveTextContent('id');
    expect(columns[1]).toHaveTextContent('project');

    await userEvent.click(screen.getByRole('button', {name: 'Apply'}));
    expect(onColumnsChange).toHaveBeenCalledWith(['id', 'project']);
  });

  it('allows adding a column', async () => {
    const onColumnsChange = jest.fn();

    renderGlobalModal();

    act(() => {
      openModal(
        modalProps => (
          <ColumnEditorModal
            {...modalProps}
            columns={['id', 'project']}
            onColumnsChange={onColumnsChange}
            stringTags={stringTags}
            numberTags={numberTags}
            booleanTags={{}}
          />
        ),
        {onClose: jest.fn()}
      );
    });

    const columns1 = ['id', 'project'];
    screen.getAllByTestId('editor-column').forEach((column, i) => {
      expect(column).toHaveTextContent(columns1[i]!);
    });

    await userEvent.click(screen.getByRole('button', {name: 'Add a Column'}));

    const columns2 = ['id', 'project', '\u2014'];
    screen.getAllByTestId('editor-column').forEach((column, i) => {
      expect(column).toHaveTextContent(columns2[i]!);
    });

    const options: Array<[string, 'string' | 'number']> = [
      ['id', 'string'],
      ['project', 'string'],
      ['span.duration', 'number'],
      ['span.op', 'string'],
    ];

    const projectColumn = screen.getAllByTestId('editor-column')[2]!;

    await userEvent.click(
      within(projectColumn).getByRole('button', {name: 'Column \u2014'})
    );
    const columnOptions = await screen.findAllByRole('option');
    columnOptions.forEach((option, i) => {
      expect(option).toHaveTextContent(options[i]![0]);
      expect(option).toHaveTextContent(options[i]![1]);
    });

    await userEvent.click(columnOptions[3]!);
    const columns3 = ['id', 'project', 'span.op'];
    screen.getAllByTestId('editor-column').forEach((column, i) => {
      expect(column).toHaveTextContent(columns3[i]!);
    });

    await userEvent.click(screen.getByRole('button', {name: 'Apply'}));
    expect(onColumnsChange).toHaveBeenCalledWith(['id', 'project', 'span.op']);
  });

  it('allows changing a column', async () => {
    const onColumnsChange = jest.fn();

    renderGlobalModal();

    act(() => {
      openModal(
        modalProps => (
          <ColumnEditorModal
            {...modalProps}
            columns={['id', 'project']}
            onColumnsChange={onColumnsChange}
            stringTags={stringTags}
            numberTags={numberTags}
            booleanTags={{}}
          />
        ),
        {onClose: jest.fn()}
      );
    });

    const columns1 = ['id', 'project'];
    screen.getAllByTestId('editor-column').forEach((column, i) => {
      expect(column).toHaveTextContent(columns1[i]!);
    });

    const options: Array<[string, 'string' | 'number']> = [
      ['id', 'string'],
      ['project', 'string'],
      ['span.duration', 'number'],
      ['span.op', 'string'],
    ];

    const projectColumn = screen.getAllByTestId('editor-column')[1]!;

    await userEvent.click(
      within(projectColumn).getByRole('button', {name: 'Column project string'})
    );
    const columnOptions = await screen.findAllByRole('option');
    columnOptions.forEach((option, i) => {
      expect(option).toHaveTextContent(options[i]![0]);
      expect(option).toHaveTextContent(options[i]![1]);
    });

    await userEvent.click(columnOptions[3]!);
    const columns2 = ['id', 'span.op'];
    screen.getAllByTestId('editor-column').forEach((column, i) => {
      expect(column).toHaveTextContent(columns2[i]!);
    });

    await userEvent.click(screen.getByRole('button', {name: 'Apply'}));
    expect(onColumnsChange).toHaveBeenCalledWith(['id', 'span.op']);
  });

  it('displays boolean tags in column options with correct type', async () => {
    renderGlobalModal();

    act(() => {
      openModal(
        modalProps => (
          <ColumnEditorModal
            {...modalProps}
            columns={['id']}
            onColumnsChange={() => {}}
            stringTags={stringTags}
            numberTags={numberTags}
            booleanTags={booleanTags}
          />
        ),
        {onClose: jest.fn()}
      );
    });

    const column = screen.getByTestId('editor-column');
    await userEvent.click(within(column).getByRole('button', {name: 'Column id string'}));

    const columnOptions = await screen.findAllByRole('option');

    const booleanOptions = columnOptions.filter(option =>
      option.textContent?.includes('boolean')
    );
    expect(booleanOptions).toHaveLength(2);
    expect(booleanOptions[0]).toHaveTextContent('exclusive_time_lost');
    expect(booleanOptions[0]).toHaveTextContent('boolean');
    expect(booleanOptions[1]).toHaveTextContent('span.is_segment');
    expect(booleanOptions[1]).toHaveTextContent('boolean');
  });

  it('allows selecting a boolean tag as a column', async () => {
    const onColumnsChange = jest.fn();

    renderGlobalModal();

    act(() => {
      openModal(
        modalProps => (
          <ColumnEditorModal
            {...modalProps}
            columns={['id']}
            onColumnsChange={onColumnsChange}
            stringTags={stringTags}
            numberTags={numberTags}
            booleanTags={booleanTags}
          />
        ),
        {onClose: jest.fn()}
      );
    });

    const column = screen.getByTestId('editor-column');
    await userEvent.click(within(column).getByRole('button', {name: 'Column id string'}));

    const columnOptions = await screen.findAllByRole('option');
    const booleanOption = columnOptions.find(
      option =>
        option.textContent?.includes('span.is_segment') &&
        option.textContent?.includes('boolean')
    );
    expect(booleanOption).toBeDefined();
    await userEvent.click(booleanOption!);

    expect(screen.getByTestId('editor-column')).toHaveTextContent('span.is_segment');
    expect(screen.getByTestId('editor-column')).toHaveTextContent('boolean');

    await userEvent.click(screen.getByRole('button', {name: 'Apply'}));
    expect(onColumnsChange).toHaveBeenCalledWith(['span.is_segment']);
  });

  it('renders existing boolean column with correct type badge', async () => {
    renderGlobalModal();

    act(() => {
      openModal(
        modalProps => (
          <ColumnEditorModal
            {...modalProps}
            columns={['span.is_segment', 'id']}
            onColumnsChange={() => {}}
            stringTags={stringTags}
            numberTags={numberTags}
            booleanTags={booleanTags}
          />
        ),
        {onClose: jest.fn()}
      );
    });

    expect(await screen.findByRole('button', {name: 'Apply'})).toBeInTheDocument();

    const columns = screen.getAllByTestId('editor-column');
    expect(columns[0]).toHaveTextContent('span.is_segment');
    expect(columns[0]).toHaveTextContent('boolean');
    expect(columns[1]).toHaveTextContent('id');
    expect(columns[1]).toHaveTextContent('string');
  });

  it('renders existing columns with types from supplied tags', async () => {
    renderGlobalModal();

    act(() => {
      openModal(
        modalProps => (
          <ColumnEditorModal
            {...modalProps}
            columns={['custom.duration', 'custom.enabled']}
            onColumnsChange={() => {}}
            stringTags={stringTags}
            numberTags={enrichedNumberTags}
            booleanTags={enrichedBooleanTags}
          />
        ),
        {onClose: jest.fn()}
      );
    });

    expect(await screen.findByRole('button', {name: 'Apply'})).toBeInTheDocument();

    const columns = screen.getAllByTestId('editor-column');
    expect(columns[0]).toHaveTextContent('custom.duration');
    expect(columns[0]).toHaveTextContent('number');
    expect(columns[1]).toHaveTextContent('custom.enabled');
    expect(columns[1]).toHaveTextContent('boolean');
  });

  it('renders existing columns with types from validated field types', async () => {
    renderGlobalModal();

    act(() => {
      openModal(
        modalProps => (
          <ColumnEditorModal
            {...modalProps}
            columns={['sentry.duration']}
            onColumnsChange={() => {}}
            stringTags={stringTags}
            numberTags={numberTags}
            booleanTags={booleanTags}
            validatedFieldTypes={{'sentry.duration': FieldValueType.NUMBER}}
          />
        ),
        {onClose: jest.fn()}
      );
    });

    expect(await screen.findByRole('button', {name: 'Apply'})).toBeInTheDocument();

    const column = screen.getByTestId('editor-column');
    expect(column).toHaveTextContent('sentry.duration');
    expect(column).toHaveTextContent('number');
  });
});
