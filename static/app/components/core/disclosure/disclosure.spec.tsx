import {render, screen} from 'sentry-test/reactTestingLibrary';

import {Disclosure} from 'sentry/components/core/disclosure/disclosure';

describe('Disclosure', () => {
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
});
