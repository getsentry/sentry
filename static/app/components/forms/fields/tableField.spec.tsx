import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
} from 'sentry-test/reactTestingLibrary';

import Form from 'sentry/components/forms/form';
import FormModel from 'sentry/components/forms/model';

import TableField from './tableField';

describe('TableField', function () {
  const mockSubmit = jest.fn();
  const model = new FormModel();

  const defaultProps = {
    columnKeys: ['column1', 'column2'],
    columnLabels: {column1: 'Column 1', column2: 'Column 2'},
    addButtonText: 'Add Thing',
    name: 'table',
  };

  describe('renders', function () {
    it('renders without form context', function () {
      const {container} = render(<TableField {...defaultProps} />);
      expect(container).toSnapshot();
    });

    it('renders with form context', function () {
      const {container} = render(
        <Form onSubmit={mockSubmit} model={model}>
          <TableField {...defaultProps} />
        </Form>
      );
      expect(container).toSnapshot();
    });

    it('renders button text', function () {
      render(
        <Form onSubmit={mockSubmit} model={model}>
          <TableField {...defaultProps} />
        </Form>
      );
      expect(screen.getByLabelText('Add Thing')).toHaveTextContent('Add Thing');
    });

    describe('saves changes', function () {
      it('handles adding a new row', function () {
        render(
          <Form onSubmit={mockSubmit} model={model}>
            <TableField {...defaultProps} />
          </Form>
        );

        userEvent.click(screen.getByLabelText('Add Thing'));

        const columns = screen.getAllByText(/Column/);
        expect(columns).toHaveLength(2);
        expect(columns[0]).toHaveTextContent('Column 1');
        expect(columns[1]).toHaveTextContent('Column 2');
      });

      it('handles removing a row', function () {
        render(
          <Form onSubmit={mockSubmit} model={model}>
            <TableField {...defaultProps} />
          </Form>
        );
        renderGlobalModal();

        // add a couple new rows
        userEvent.click(screen.getByLabelText('Add Thing'));
        userEvent.click(screen.getByLabelText('Add Thing'));

        // delete the last row
        userEvent.click(screen.getAllByLabelText(/delete/).at(-1)!);

        // click through confirmation
        userEvent.click(screen.getByTestId('confirm-button'));

        expect(screen.getByTestId('field-row')).toBeInTheDocument();
      });
    });
  });
});
