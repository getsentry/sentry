import {mountWithTheme, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import Button from 'sentry/components/button';
import Collapsible from 'sentry/components/collapsible';

const items = [1, 2, 3, 4, 5, 6, 7].map(i => <div key={i}>Item {i}</div>);

describe('Collapsible', function () {
  it('collapses items', function () {
    mountWithTheme(<Collapsible>{items}</Collapsible>);

    expect(screen.getAllByText(/Item/)).toHaveLength(5);
    expect(screen.getAllByText(/Item/)[2].innerHTML).toBe('Item 3');

    expect(screen.getByLabelText('Show 2 hidden items')).toBeInTheDocument();
    expect(screen.queryByLabelText('Collapse')).not.toBeInTheDocument();
  });

  it('expands items', function () {
    mountWithTheme(<Collapsible>{items}</Collapsible>);

    // expand
    userEvent.click(screen.getByLabelText('Show 2 hidden items'));

    expect(screen.getAllByText(/Item/)).toHaveLength(7);

    // collapse back
    userEvent.click(screen.getByLabelText('Collapse'));

    expect(screen.getAllByText(/Item/)).toHaveLength(5);
  });

  it('respects maxVisibleItems prop', function () {
    mountWithTheme(<Collapsible maxVisibleItems={2}>{items}</Collapsible>);

    expect(screen.getAllByText(/Item/)).toHaveLength(2);
  });

  it('does not collapse items below threshold', function () {
    mountWithTheme(<Collapsible maxVisibleItems={100}>{items}</Collapsible>);

    expect(screen.getAllByText(/Item/)).toHaveLength(7);
    expect(screen.queryByLabelText(/hidden item/)).not.toBeInTheDocument();
  });

  it('takes custom buttons', function () {
    mountWithTheme(
      <Collapsible
        collapseButton={({onCollapse}) => (
          <Button onClick={onCollapse}>Custom Collapse</Button>
        )}
        expandButton={({onExpand, numberOfCollapsedItems}) => (
          <Button onClick={onExpand} aria-label="Expand">
            Custom Expand {numberOfCollapsedItems}
          </Button>
        )}
      >
        {items}
      </Collapsible>
    );

    expect(screen.getByText(/Custom/)).toBeInTheDocument();

    // custom expand
    userEvent.click(screen.getByLabelText('Expand'));

    expect(screen.getAllByText(/Item/)).toHaveLength(7);

    // custom collapse back
    userEvent.click(screen.getByText('Custom Collapse'));

    expect(screen.getAllByText(/Item/)).toHaveLength(5);
  });
});
