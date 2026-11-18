import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {ExploreSidebarToggle} from './exploreSidebarToggle';

describe('ExploreSidebarToggle', () => {
  it('shows Advanced until the sidebar is expanded', async () => {
    const onExpandedChange = jest.fn();
    render(<ExploreSidebarToggle expanded={false} onExpandedChange={onExpandedChange} />);

    const button = screen.getByRole('button', {name: 'Expand sidebar'});
    expect(button).toHaveTextContent('Advanced');

    await userEvent.click(button);
    expect(onExpandedChange).toHaveBeenCalledWith(true);
  });

  it('collapses the sidebar from the double chevron', async () => {
    const onExpandedChange = jest.fn();
    render(<ExploreSidebarToggle expanded onExpandedChange={onExpandedChange} />);

    const button = screen.getByRole('button', {name: 'Collapse sidebar'});
    expect(button).not.toHaveTextContent('Advanced');

    await userEvent.click(button);
    expect(onExpandedChange).toHaveBeenCalledWith(false);
  });
});
