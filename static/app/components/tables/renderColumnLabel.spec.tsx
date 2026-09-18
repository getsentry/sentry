import {Fragment} from 'react';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {renderColumnLabel} from 'sentry/components/tables/renderColumnLabel';

describe('renderColumnLabel', () => {
  it('returns the column name when given no tooltip or align', () => {
    expect(renderColumnLabel({column: {name: 'Duration'}})).toBe('Duration');
  });

  it("shows the column's tooltip on hover when the column has one", async () => {
    render(
      <Fragment>
        {renderColumnLabel({column: {name: 'Duration', tooltip: 'Total time'}})}
      </Fragment>
    );

    await userEvent.hover(screen.getByText('Duration'));

    expect(await screen.findByText('Total time')).toBeInTheDocument();
  });

  it("shows the given tooltip over the column's own when given both", async () => {
    render(
      <Fragment>
        {renderColumnLabel({
          column: {name: 'Duration', tooltip: 'Total time'},
          tooltip: 'Override',
        })}
      </Fragment>
    );

    await userEvent.hover(screen.getByText('Duration'));

    expect(await screen.findByText('Override')).toBeInTheDocument();
  });
});
