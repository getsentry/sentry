import {act, renderGlobalModal, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {openModal} from 'sentry/actionCreators/modal';
import {ColumnEditorModal} from 'sentry/views/explore/tables/columnEditorModal';

const tagOptions = {
  id: {
    key: 'id',
    name: 'ID',
  },
  project: {
    key: 'project',
    name: 'Project',
  },
  'span.op': {
    key: 'span.op',
    name: 'Span OP',
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
            tags={tagOptions}
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
            tags={tagOptions}
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
            tags={tagOptions}
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

    const options = ['id', 'project', 'span.op'];
    await userEvent.click(screen.getByRole('button', {name: 'None'}));
    const columnOptions = await screen.findAllByRole('option');
    columnOptions.forEach((option, i) => {
      expect(option).toHaveTextContent(options[i]);
    });

    await userEvent.click(columnOptions[2]);
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
            tags={tagOptions}
          />
        ),
        {onClose: jest.fn()}
      );
    });

    const columns1 = ['id', 'project'];
    screen.getAllByTestId('editor-column').forEach((column, i) => {
      expect(column).toHaveTextContent(columns1[i]);
    });

    const options = ['id', 'project', 'span.op'];
    await userEvent.click(screen.getByRole('button', {name: 'project'}));
    const columnOptions = await screen.findAllByRole('option');
    columnOptions.forEach((option, i) => {
      expect(option).toHaveTextContent(options[i]);
    });

    await userEvent.click(columnOptions[2]);
    const columns2 = ['id', 'span.op'];
    screen.getAllByTestId('editor-column').forEach((column, i) => {
      expect(column).toHaveTextContent(columns2[i]);
    });

    await userEvent.click(screen.getByRole('button', {name: 'Apply'}));
    expect(onColumnsChange).toHaveBeenCalledWith(['id', 'span.op']);
  });
});
