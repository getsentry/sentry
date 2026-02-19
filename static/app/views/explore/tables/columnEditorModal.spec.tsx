import {
  act,
  renderGlobalModal,
  screen,
  userEvent,
  within,
} from 'sentry-test/reactTestingLibrary';

import {openModal} from 'sentry/actionCreators/modal';
import type {TagCollection} from 'sentry/types/group';
import {FieldKind} from 'sentry/utils/fields';
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
});
