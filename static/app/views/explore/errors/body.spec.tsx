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
  it('renders collapse sidebar button when expanded', async () => {
    const setControlSectionExpanded = jest.fn();
    render(
      <ErrorsContentSection
        controlSectionExpanded
        setControlSectionExpanded={setControlSectionExpanded}
      />
    );

    const collapseButton = await screen.findByRole('button', {name: 'Collapse sidebar'});
    expect(collapseButton).toBeInTheDocument();
    expect(collapseButton).not.toHaveTextContent('Advanced');
  });

  it('renders expand sidebar button when collapsed', async () => {
    const setControlSectionExpanded = jest.fn();
    render(
      <ErrorsContentSection
        controlSectionExpanded={false}
        setControlSectionExpanded={setControlSectionExpanded}
      />
    );

    const expandButton = await screen.findByRole('button', {name: 'Expand sidebar'});
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

    await userEvent.click(await screen.findByRole('button', {name: 'Collapse sidebar'}));
    expect(setControlSectionExpanded).toHaveBeenCalledWith(false);
  });

  it('renders Export and Settings buttons', async () => {
    render(
      <ErrorsContentSection
        controlSectionExpanded
        setControlSectionExpanded={jest.fn()}
      />
    );

    expect(await screen.findByRole('button', {name: 'Export data'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Settings'})).toBeInTheDocument();
  });
});
