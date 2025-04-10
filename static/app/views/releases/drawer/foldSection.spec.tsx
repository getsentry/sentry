import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {FoldSection} from './foldSection';

describe('FoldSection', function () {
  it('renders basic section with title and content', function () {
    render(
      <FoldSection title="Test Section" sectionKey="test-section">
        <div>Test Content</div>
      </FoldSection>
    );

    expect(
      screen.getByRole('button', {name: /Collapse Test Section Section/})
    ).toBeInTheDocument();
    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });

  it('can toggle section collapse state', async function () {
    render(
      <FoldSection title="Test Section" sectionKey="test-section">
        <div>Test Content</div>
      </FoldSection>
    );

    // Initially expanded
    expect(screen.getByText('Test Content')).toBeInTheDocument();

    // Click to collapse
    await userEvent.click(
      screen.getByRole('button', {name: /Collapse Test Section Section/})
    );
    expect(screen.queryByText('Test Content')).not.toBeInTheDocument();

    // Click to expand
    await userEvent.click(
      screen.getByRole('button', {name: /View Test Section Section/})
    );
    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });

  it('respects initialCollapse prop', function () {
    render(
      <FoldSection title="Test Section" sectionKey="test-section" initialCollapse>
        <div>Test Content</div>
      </FoldSection>
    );

    expect(screen.queryByText('Test Content')).not.toBeInTheDocument();
  });

  it('prevents collapsing when preventCollapse is true', async function () {
    render(
      <FoldSection title="Test Section" sectionKey="test-section" preventCollapse>
        <div>Test Content</div>
      </FoldSection>
    );

    const button = screen.getByRole('button', {name: /Test Section Section/});
    await userEvent.click(button);

    // Content should still be visible
    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });

  it('renders actions when provided and section is expanded', async function () {
    const actions = <button>Action Button</button>;

    render(
      <FoldSection title="Test Section" sectionKey="test-section" actions={actions}>
        <div>Test Content</div>
      </FoldSection>
    );

    // Actions should be visible when expanded
    expect(screen.getByRole('button', {name: 'Action Button'})).toBeInTheDocument();

    // Click to collapse
    await userEvent.click(
      screen.getByRole('button', {name: /Collapse Test Section Section/})
    );

    // Actions should not be visible when collapsed
    expect(screen.queryByRole('button', {name: 'Action Button'})).not.toBeInTheDocument();
  });

  it('calls onChange when toggling collapse state', async function () {
    const handleChange = jest.fn();

    render(
      <FoldSection
        title="Test Section"
        sectionKey="test-section"
        isCollapsed={false}
        onChange={handleChange}
      >
        <div>Test Content</div>
      </FoldSection>
    );

    // Click to collapse
    await userEvent.click(
      screen.getByRole('button', {name: /Collapse Test Section Section/})
    );
    expect(handleChange).toHaveBeenCalledWith(true);

    // Since it's controlled, nothing actually happens
    expect(screen.getByText('Test Content')).toBeInTheDocument();

    render(
      <FoldSection
        title="Test Section"
        sectionKey="test-section"
        isCollapsed
        onChange={handleChange}
      >
        <div>Test Content</div>
      </FoldSection>
    );
    // Click to expand
    await userEvent.click(
      screen.getByRole('button', {name: /View Test Section Section/})
    );
    expect(handleChange).toHaveBeenCalledWith(false);

    // Since it's controlled, nothing actually happens
    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });

  it('scrolls to section when hash matches sectionKey', async function () {
    // Mock window.location.hash
    const originalHash = window.location.hash;
    window.location.hash = '#test-section';

    const scrollIntoViewMock = jest.fn();
    Element.prototype.scrollIntoView = scrollIntoViewMock;

    render(
      <FoldSection title="Test Section" initialCollapse sectionKey="test-section">
        <div>Test Content</div>
      </FoldSection>
    );

    expect(screen.getByText('Test Content')).toBeInTheDocument();

    // Wait for the setTimeout in the component
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(scrollIntoViewMock).toHaveBeenCalled();

    // Cleanup
    window.location.hash = originalHash;
  });
});
