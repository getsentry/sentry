import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import Accordion from 'sentry/components/accordion/accordion';

const items = [
  {header: () => <p>header</p>, content: () => <p>first content</p>},
  {header: () => <p>second header</p>, content: () => <p>second content</p>},
];

describe('Accordion', function () {
  it('renders expanded item', async function () {
    render(<Accordion expandedIndex={0} setExpandedIndex={() => {}} items={items} />);
    expect(await screen.findByText('first content')).toBeInTheDocument();
    expect(screen.queryByText('second content')).not.toBeInTheDocument();
  });

  it('invokes callback on header click', async function () {
    const spy = jest.fn();
    render(<Accordion expandedIndex={0} setExpandedIndex={spy} items={items} />);
    await userEvent.click(
      screen.getByRole('button', {
        expanded: false,
      })
    );
    expect(spy).toHaveBeenCalled();
  });
});
