import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {Button} from 'sentry/components/button';
import Collapsible from 'sentry/components/collapsible';

const items = [1, 2, 3, 4, 5, 6, 7].map(i => <div key={i}>Item {i}</div>);

describe('Collapsible', function () {
  it('collapses items', function () {
    render(<Collapsible>{items}</Collapsible>);

    expect(screen.getAllByText(/Item/)).toHaveLength(5);
    expect(screen.getAllByText(/Item/)[2]!.innerHTML).toBe('Item 3');

    expect(screen.getByLabelText('Show 2 hidden items')).toBeInTheDocument();
    expect(screen.queryByLabelText('Collapse')).not.toBeInTheDocument();
  });

  it('expands items', async function () {
    render(<Collapsible>{items}</Collapsible>);

    // expand
    await userEvent.click(screen.getByLabelText('Show 2 hidden items'));

    expect(screen.getAllByText(/Item/)).toHaveLength(7);

    // collapse back
    await userEvent.click(screen.getByLabelText('Collapse'));

    expect(screen.getAllByText(/Item/)).toHaveLength(5);
  });

  it('respects maxVisibleItems prop', function () {
    render(<Collapsible maxVisibleItems={2}>{items}</Collapsible>);

    expect(screen.getAllByText(/Item/)).toHaveLength(2);
  });

  it('does not collapse items below threshold', function () {
    render(<Collapsible maxVisibleItems={100}>{items}</Collapsible>);

    expect(screen.getAllByText(/Item/)).toHaveLength(7);
    expect(screen.queryByLabelText(/hidden item/)).not.toBeInTheDocument();
  });

  it('takes custom buttons', async function () {
    render(
      <Collapsible
        collapseButton={({onCollapse}) => (
          <Button onClick={onCollapse}>Custom Collapse</Button>
        )}
        expandButton={({onExpand, numberOfHiddenItems}) => (
          <Button onClick={onExpand} aria-label="Expand">
            Custom Expand {numberOfHiddenItems}
          </Button>
        )}
      >
        {items}
      </Collapsible>
    );

    expect(screen.getByText(/Custom/)).toBeInTheDocument();

    // custom expand
    await userEvent.click(screen.getByLabelText('Expand'));

    expect(screen.getAllByText(/Item/)).toHaveLength(7);

    // custom collapse back
    await userEvent.click(screen.getByText('Custom Collapse'));

    expect(screen.getAllByText(/Item/)).toHaveLength(5);
  });
});
