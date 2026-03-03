import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {useExpando, type Expando} from './useExpando';

let hookResult: Expando;

function ExpandoWrapper() {
  hookResult = useExpando();
  return <div>{hookResult.button}</div>;
}

const mockScrollIntoView = jest.fn();

describe('useExpando', () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = mockScrollIntoView;
  });

  it('sets expanded to false when the button is not yet clicked', () => {
    render(<ExpandoWrapper />);

    expect(screen.getByText('Expand')).toBeInTheDocument();
    expect(hookResult.expanded).toBe(false);
  });

  it('sets expanded to true and scrolls into view when the button is clicked', async () => {
    render(<ExpandoWrapper />);

    await userEvent.click(screen.getByText('Expand'));

    expect(screen.getByText('Collapse')).toBeInTheDocument();
    expect(hookResult.expanded).toBe(true);
    expect(mockScrollIntoView.mock.calls).toEqual([[{block: 'start'}]]);
  });

  it('sets expanded to false when the button is clicked a second time', async () => {
    render(<ExpandoWrapper />);

    await userEvent.click(screen.getByText('Expand'));
    await userEvent.click(screen.getByText('Collapse'));

    expect(screen.getByText('Expand')).toBeInTheDocument();
    expect(hookResult.expanded).toBe(false);
    expect(mockScrollIntoView.mock.calls).toEqual([[{block: 'start'}]]);
  });
});
