import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {ErrorsContentSection, ErrorsControlSection} from './body';

describe('ErrorsControlSection', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders as an aside element', () => {
    render(<ErrorsControlSection controlSectionExpanded />);
    expect(screen.getByRole('complementary')).toBeInTheDocument();
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
