import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {ScmCollapsibleSection} from './scmCollapsibleSection';

describe('ScmCollapsibleSection', () => {
  it('renders the title and content expanded by default', () => {
    render(
      <ScmCollapsibleSection title="Section title">
        <div>Body content</div>
      </ScmCollapsibleSection>
    );

    expect(screen.getByRole('button', {name: 'Section title'})).toBeInTheDocument();
    expect(screen.getByText('Body content')).toBeInTheDocument();
  });

  it('starts collapsed when defaultExpanded is false', () => {
    render(
      <ScmCollapsibleSection title="Section title" defaultExpanded={false}>
        <div>Body content</div>
      </ScmCollapsibleSection>
    );

    expect(screen.queryByText('Body content')).not.toBeInTheDocument();
  });

  it('toggles the content when the title is clicked', async () => {
    render(
      <ScmCollapsibleSection title="Section title">
        <div>Body content</div>
      </ScmCollapsibleSection>
    );

    const toggle = screen.getByRole('button', {name: 'Section title'});
    expect(toggle).toHaveAttribute('aria-expanded', 'true');

    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Body content')).not.toBeInTheDocument();

    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Body content')).toBeInTheDocument();
  });

  it('renders trailing content in the header', () => {
    render(
      <ScmCollapsibleSection title="Section title" trailing={<span>Trailing</span>}>
        <div>Body content</div>
      </ScmCollapsibleSection>
    );

    expect(screen.getByText('Trailing')).toBeInTheDocument();
  });
});
