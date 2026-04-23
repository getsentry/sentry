import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {ErrorsContentSection, ErrorsControlSection} from './body';

describe('ErrorsControlSection', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders as an aside element', async () => {
    render(<ErrorsControlSection controlSectionExpanded />);
    expect(await screen.findByRole('complementary')).toBeInTheDocument();
  });
});

describe('ErrorsContentSection', () => {
  it('renders collapse sidebar button when expanded', () => {
    const setControlSectionExpanded = jest.fn();
    render(
      <ErrorsContentSection
        controlSectionExpanded
        setControlSectionExpanded={setControlSectionExpanded}
      />
    );

    const collapseButton = screen.getByRole('button', {name: 'Collapse sidebar'});
    expect(collapseButton).toBeInTheDocument();
    expect(collapseButton).not.toHaveTextContent('Advanced');
  });

  it('renders expand sidebar button when collapsed', () => {
    const setControlSectionExpanded = jest.fn();
    render(
      <ErrorsContentSection
        controlSectionExpanded={false}
        setControlSectionExpanded={setControlSectionExpanded}
      />
    );

    const expandButton = screen.getByRole('button', {name: 'Expand sidebar'});
    expect(expandButton).toBeInTheDocument();
    expect(expandButton).toHaveTextContent('Advanced');
  });

  it('renders the errors tables section', () => {
    const setControlSectionExpanded = jest.fn();
    render(
      <ErrorsContentSection
        controlSectionExpanded
        setControlSectionExpanded={setControlSectionExpanded}
      />
    );

    expect(screen.getByRole('tab', {name: 'Errors'})).toBeInTheDocument();
    expect(screen.getByRole('tab', {name: 'Aggregates'})).toBeInTheDocument();
    expect(screen.getByRole('tab', {name: 'Attribute Breakdowns'})).toBeInTheDocument();
    expect(screen.getByTestId('errors-table')).toBeInTheDocument();
  });

  it('calls setControlSectionExpanded when clicking collapse button', async () => {
    const setControlSectionExpanded = jest.fn();
    render(
      <ErrorsContentSection
        controlSectionExpanded
        setControlSectionExpanded={setControlSectionExpanded}
      />
    );

    await userEvent.click(screen.getByRole('button', {name: 'Collapse sidebar'}));
    expect(setControlSectionExpanded).toHaveBeenCalledWith(false);
  });
});
