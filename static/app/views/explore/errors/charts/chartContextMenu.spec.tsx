import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {ChartContextMenu} from './chartContextMenu';

describe('ChartContextMenu', () => {
  it('shows "Create an Alert" by default', async () => {
    render(<ChartContextMenu visible setVisible={jest.fn()} />, {
      organization: OrganizationFixture(),
    });

    await userEvent.click(screen.getByRole('button'));
    expect(
      screen.getByRole('menuitemradio', {name: 'Create an Alert'})
    ).toBeInTheDocument();
  });

  it('shows "Create a Monitor" with workflow-engine-ui feature', async () => {
    render(<ChartContextMenu visible setVisible={jest.fn()} />, {
      organization: OrganizationFixture({features: ['workflow-engine-ui']}),
    });

    await userEvent.click(screen.getByRole('button'));
    expect(
      screen.getByRole('menuitemradio', {name: 'Create a Monitor'})
    ).toBeInTheDocument();
  });

  // TODO: check disabled for no dashboards-edit feature
  it('"Add to Dashboard" is disabled for now', async () => {
    render(<ChartContextMenu visible setVisible={jest.fn()} />, {
      organization: OrganizationFixture({features: []}),
    });

    await userEvent.click(screen.getByRole('button'));
    expect(screen.getByRole('menuitemradio', {name: 'Add to Dashboard'})).toHaveAttribute(
      'aria-disabled',
      'true'
    );
  });

  it('shows "Hide Chart" when visible', async () => {
    render(<ChartContextMenu visible setVisible={jest.fn()} />, {
      organization: OrganizationFixture(),
    });

    await userEvent.click(screen.getByRole('button'));
    expect(screen.getByRole('menuitemradio', {name: 'Hide Chart'})).toBeInTheDocument();
  });

  it('shows "Show Chart" when not visible', async () => {
    render(<ChartContextMenu visible={false} setVisible={jest.fn()} />, {
      organization: OrganizationFixture(),
    });

    await userEvent.click(screen.getByRole('button'));
    expect(screen.getByRole('menuitemradio', {name: 'Show Chart'})).toBeInTheDocument();
  });

  it('calls setVisible(false) when "Hide Chart" is clicked', async () => {
    const setVisible = jest.fn();
    render(<ChartContextMenu visible setVisible={setVisible} />, {
      organization: OrganizationFixture(),
    });

    await userEvent.click(screen.getByRole('button'));
    await userEvent.click(screen.getByRole('menuitemradio', {name: 'Hide Chart'}));
    expect(setVisible).toHaveBeenCalledWith(false);
  });

  it('calls setVisible(true) when "Show Chart" is clicked', async () => {
    const setVisible = jest.fn();
    render(<ChartContextMenu visible={false} setVisible={setVisible} />, {
      organization: OrganizationFixture(),
    });

    await userEvent.click(screen.getByRole('button'));
    await userEvent.click(screen.getByRole('menuitemradio', {name: 'Show Chart'}));
    expect(setVisible).toHaveBeenCalledWith(true);
  });
});
