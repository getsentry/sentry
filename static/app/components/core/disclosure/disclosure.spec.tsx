import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {Disclosure} from '@sentry/scraps/disclosure';

describe('Disclosure', () => {
  it('supports attaching a render ref to the panel', () => {
    const panelRef = jest.fn();
    render(
      <Disclosure ref={panelRef}>
        <Disclosure.Title>This is a disclosure</Disclosure.Title>
        <Disclosure.Content>This is the content of the disclosure</Disclosure.Content>
      </Disclosure>
    );
    expect(panelRef).toHaveBeenCalledWith(expect.any(HTMLDivElement));
  });

  it('renders as expanded by default', () => {
    render(
      <Disclosure>
        <Disclosure.Title>This is a disclosure</Disclosure.Title>
        <Disclosure.Content>This is the content of the disclosure</Disclosure.Content>
      </Disclosure>
    );
    expect(screen.getByText('This is a disclosure')).toBeVisible();
    expect(screen.getByText('This is the content of the disclosure')).toBeInTheDocument();
  });

  it('renders as collapsed when expanded=false', () => {
    render(
      <Disclosure expanded={false}>
        <Disclosure.Title>This is a disclosure</Disclosure.Title>
        <Disclosure.Content>This is the content of the disclosure</Disclosure.Content>
      </Disclosure>
    );
    expect(screen.queryByText('This is the content of the disclosure')).not.toBeVisible();
  });

  it('renders as collapsed when defaultExpanded=false', () => {
    render(
      <Disclosure defaultExpanded={false}>
        <Disclosure.Title>This is a disclosure</Disclosure.Title>
        <Disclosure.Content>This is the content of the disclosure</Disclosure.Content>
      </Disclosure>
    );
    expect(screen.queryByText('This is the content of the disclosure')).not.toBeVisible();
  });

  it('toggling a disclosure triggers the onExpandedChange callback', async () => {
    const onExpandedChange = jest.fn();
    render(
      <Disclosure onExpandedChange={onExpandedChange}>
        <Disclosure.Title>This is a disclosure</Disclosure.Title>
        <Disclosure.Content>This is the content of the disclosure</Disclosure.Content>
      </Disclosure>
    );
    await userEvent.click(screen.getByRole('button', {name: 'This is a disclosure'}));
    expect(onExpandedChange).toHaveBeenCalledWith(true);

    await userEvent.click(screen.getByRole('button', {name: 'This is a disclosure'}));
    expect(onExpandedChange).toHaveBeenCalledWith(false);
  });

  it('renders leading items and still toggles', async () => {
    render(
      <Disclosure defaultExpanded>
        <Disclosure.Title leadingItems={<span>glyph</span>}>Titled</Disclosure.Title>
        <Disclosure.Content>Body</Disclosure.Content>
      </Disclosure>
    );

    expect(screen.getByText('glyph')).toBeInTheDocument();
    expect(screen.getByText('Body')).toBeVisible();
    await userEvent.click(screen.getByRole('button', {name: 'Titled'}));
    expect(screen.getByText('Body')).not.toBeVisible();
  });

  it('renders outline content and keeps it toggleable', async () => {
    render(
      <Disclosure variant="outline" defaultExpanded>
        <Disclosure.Title>Titled</Disclosure.Title>
        <Disclosure.Content>Outlined body</Disclosure.Content>
      </Disclosure>
    );

    expect(screen.getByText('Outlined body')).toBeVisible();
    await userEvent.click(screen.getByRole('button', {name: 'Titled'}));
    expect(screen.getByText('Outlined body')).not.toBeVisible();
  });
});
