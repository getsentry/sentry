import {act, renderGlobalModal, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {openModal} from 'sentry/actionCreators/modal';
import type {TagCollection} from 'sentry/types/group';
import {ColumnEditorModal} from 'sentry/views/explore/tables/columnEditorModal';

const stringTags: TagCollection = {
  id: {
    key: 'id',
    name: 'id',
  },
  project: {
    key: 'project',
    name: 'project',
  },
  'span.op': {
    key: 'span.op',
    name: 'span.op',
  },
};

const numberTags: TagCollection = {
  'span.duration': {
    key: 'span.duration',
    name: 'span.duration',
  },
};

describe('ColumnEditorModal', function () {
  beforeEach(function () {
    // without this the `CompactSelect` component errors with a bunch of async updates
    jest.spyOn(console, 'error').mockImplementation();
  });

  it('allows closes modal on apply', async function () {
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
          />
        ),
        {onClose}
      );
    });

    expect(onClose).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', {name: 'Apply'}));
    expect(onClose).toHaveBeenCalled();
  });

  it('allows deleting a column', async function () {
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
          />
        ),
        {onClose: jest.fn()}
      );
    });

    const columns1 = ['id', 'project'];
    screen.getAllByTestId('editor-column').forEach((column, i) => {
      expect(column).toHaveTextContent(columns1[i]);
    });

    await userEvent.click(screen.getAllByLabelText('Remove Column')[0]);

    const columns2 = ['project'];
    screen.getAllByTestId('editor-column').forEach((column, i) => {
      expect(column).toHaveTextContent(columns2[i]);
    });

    // only 1 column remaining, disable the delete option
    expect(screen.getByLabelText('Remove Column')).toBeDisabled();

    await userEvent.click(screen.getByRole('button', {name: 'Apply'}));
    expect(onColumnsChange).toHaveBeenCalledWith(['project']);
  });

  it('allows adding a column', async function () {
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
          />
        ),
        {onClose: jest.fn()}
      );
    });

    const columns1 = ['id', 'project'];
    screen.getAllByTestId('editor-column').forEach((column, i) => {
      expect(column).toHaveTextContent(columns1[i]);
    });

    await userEvent.click(screen.getByRole('button', {name: 'Add a Column'}));

    const columns2 = ['id', 'project', 'None'];
    screen.getAllByTestId('editor-column').forEach((column, i) => {
      expect(column).toHaveTextContent(columns2[i]);
    });

    const options: [string, 'string' | 'number'][] = [
      ['id', 'string'],
      ['project', 'string'],
      ['span.duration', 'number'],
      ['span.op', 'string'],
    ];
    await userEvent.click(screen.getByRole('button', {name: 'Column None'}));
    const columnOptions = await screen.findAllByRole('option');
    columnOptions.forEach((option, i) => {
      expect(option).toHaveTextContent(options[i][0]);
      expect(option).toHaveTextContent(options[i][1]);
    });

    await userEvent.click(columnOptions[3]);
    const columns3 = ['id', 'project', 'span.op'];
    screen.getAllByTestId('editor-column').forEach((column, i) => {
      expect(column).toHaveTextContent(columns3[i]);
    });

    await userEvent.click(screen.getByRole('button', {name: 'Apply'}));
    expect(onColumnsChange).toHaveBeenCalledWith(['id', 'project', 'span.op']);
  });

  it('allows changing a column', async function () {
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
          />
        ),
        {onClose: jest.fn()}
      );
    });

    const columns1 = ['id', 'project'];
    screen.getAllByTestId('editor-column').forEach((column, i) => {
      expect(column).toHaveTextContent(columns1[i]);
    });

    const options: [string, 'string' | 'number'][] = [
      ['id', 'string'],
      ['project', 'string'],
      ['span.duration', 'number'],
      ['span.op', 'string'],
    ];
    await userEvent.click(screen.getByRole('button', {name: 'Column project string'}));
    const columnOptions = await screen.findAllByRole('option');
    columnOptions.forEach((option, i) => {
      expect(option).toHaveTextContent(options[i][0]);
      expect(option).toHaveTextContent(options[i][1]);
    });

    await userEvent.click(columnOptions[3]);
    const columns2 = ['id', 'span.op'];
    screen.getAllByTestId('editor-column').forEach((column, i) => {
      expect(column).toHaveTextContent(columns2[i]);
    });

    await userEvent.click(screen.getByRole('button', {name: 'Apply'}));
    expect(onColumnsChange).toHaveBeenCalledWith(['id', 'span.op']);
  });
});
