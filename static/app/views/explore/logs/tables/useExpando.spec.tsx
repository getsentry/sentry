import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {useExpando} from './useExpando';

function ExpandoWrapper() {
  const {button} = useExpando();
  return <div>{button}</div>;
}

describe('useExpando', () => {
  it('is contracted when the button is not yet clicked', () => {
    render(<ExpandoWrapper />);

    expect(screen.getByText('Expand')).toBeInTheDocument();
  });

  it('expands when the button is clicked', async () => {
    render(<ExpandoWrapper />);

    await userEvent.click(screen.getByText('Expand'));

    expect(screen.getByText('Collapse')).toBeInTheDocument();
  });

  it('contracts when the button is clicked a second time', async () => {
    render(<ExpandoWrapper />);

    await userEvent.click(screen.getByText('Expand'));
    await userEvent.click(screen.getByText('Collapse'));

    expect(screen.getByText('Expand')).toBeInTheDocument();
  });
});
