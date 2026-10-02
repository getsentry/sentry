import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {ColumnLabel} from 'sentry/components/tables/columnLabel';

describe('ColumnLabel', () => {
  it('renders the column name when given no tooltip or align', () => {
    render(<ColumnLabel column={{name: 'Duration'}} />);

    expect(screen.getByText('Duration')).toBeInTheDocument();
  });

  it("shows the column's tooltip on hover when the column has one", async () => {
    render(<ColumnLabel column={{name: 'Duration', tooltip: 'Total time'}} />);

    await userEvent.hover(screen.getByText('Duration'));

    expect(await screen.findByText('Total time')).toBeInTheDocument();
  });

  it("shows the given tooltip over the column's own when given both", async () => {
    render(
      <ColumnLabel
        column={{name: 'Duration', tooltip: 'Total time'}}
        tooltip="Override"
      />
    );

    await userEvent.hover(screen.getByText('Duration'));

    expect(await screen.findByText('Override')).toBeInTheDocument();
  });
});
