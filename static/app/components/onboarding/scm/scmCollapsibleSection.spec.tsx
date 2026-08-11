import {MotionGlobalConfig} from 'framer-motion';

import {
  act,
  render,
  screen,
  userEvent,
  waitFor,
  waitForElementToBeRemoved,
} from 'sentry-test/reactTestingLibrary';

import {ScmCollapsibleSection} from './scmCollapsibleSection';

function waitForAnimationToStart() {
  return act(
    () =>
      new Promise<void>(resolve => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      })
  );
}

describe('ScmCollapsibleSection', () => {
  afterEach(() => {
    MotionGlobalConfig.skipAnimations = true;
  });

  it('renders content with visible overflow when expanded by default', () => {
    render(
      <ScmCollapsibleSection title="Section title">
        <div>Body content</div>
      </ScmCollapsibleSection>
    );

    const toggle = screen.getByRole('button', {name: 'Section title'});
    const contentId = toggle.getAttribute('aria-controls');

    expect(contentId).not.toBeNull();
    expect(document.getElementById(contentId!)).toHaveStyle({overflow: 'visible'});
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

  it('clips content while expanding and collapsing', async () => {
    MotionGlobalConfig.skipAnimations = false;
    render(
      <ScmCollapsibleSection title="Section title" defaultExpanded={false}>
        <div>Body content</div>
      </ScmCollapsibleSection>
    );

    const toggle = screen.getByRole('button', {name: 'Section title'});
    await userEvent.click(toggle);
    const contentId = toggle.getAttribute('aria-controls');
    expect(contentId).not.toBeNull();
    const content = document.getElementById(contentId!);
    expect(content).not.toBeNull();

    await waitForAnimationToStart();
    expect(content).toHaveStyle({overflow: 'hidden'});

    await waitFor(() => expect(content).toHaveStyle({overflow: 'visible'}));

    await userEvent.click(toggle);
    await waitForAnimationToStart();
    expect(content).toBeInTheDocument();
    expect(content).toHaveStyle({overflow: 'hidden'});
    await waitForElementToBeRemoved(content);
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
