import {fireEvent, render, screen} from 'sentry-test/reactTestingLibrary';

import {DocumentComposerDemo} from './documentDemos';

jest.unmock('prismjs');

it.each(['dropzone', 'editor'])('queues a file once when dropped on the %s', target => {
  render(<DocumentComposerDemo />);
  const dropzone = screen.getByRole('group', {name: 'Composer dropzone'});
  const destination =
    target === 'editor'
      ? screen.getByRole('combobox', {name: 'Comment document'})
      : dropzone;
  const file = new File(['example'], 'example.txt', {type: 'text/plain'});
  const dataTransfer = {types: ['Files'], files: [file]};

  fireEvent.dragEnter(destination, {dataTransfer});
  expect(screen.getByText('Drop files to attach')).toBeVisible();

  fireEvent(
    destination,
    new MouseEvent('dragleave', {
      bubbles: true,
      relatedTarget: screen.getByRole('button', {name: 'Bold'}),
    })
  );
  expect(screen.getByText('Drop files to attach')).toBeVisible();

  fireEvent.drop(destination, {dataTransfer});
  expect(screen.queryByText('Drop files to attach')).not.toBeInTheDocument();
  expect(screen.getAllByRole('button', {name: 'Insert example.txt'})).toHaveLength(1);
});

it('ignores text drags and clears the file target when the drag leaves the composer', () => {
  render(<DocumentComposerDemo />);
  const dropzone = screen.getByRole('group', {name: 'Composer dropzone'});
  const text = {types: ['text/plain'], files: []};
  fireEvent.dragEnter(dropzone, {dataTransfer: text});
  expect(screen.queryByText('Drop files to attach')).not.toBeInTheDocument();

  const file = new File(['example'], 'example.txt', {type: 'text/plain'});
  const dataTransfer = {types: ['Files'], files: [file]};
  fireEvent.dragEnter(dropzone, {dataTransfer});
  expect(screen.getByText('Drop files to attach')).toBeVisible();
  fireEvent.dragLeave(dropzone, {dataTransfer, relatedTarget: null});
  expect(screen.queryByText('Drop files to attach')).not.toBeInTheDocument();
});
