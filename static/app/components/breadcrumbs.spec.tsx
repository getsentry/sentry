import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {Breadcrumbs} from 'sentry/components/breadcrumbs';

describe('Breadcrumbs', () => {
  function createWrapper() {
    return render(
      <Breadcrumbs
        crumbs={[
          {
            label: 'Test 1',
            to: '/test1',
          },
          {
            label: 'Test 2',
            to: '/test2',
          },
          {
            label: 'Test 3',
            to: null,
          },
        ]}
      />
    );
  }

  it('returns null when 0 crumbs', () => {
    const {container} = render(<Breadcrumbs crumbs={[]} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('renders crumbs with icon', () => {
    createWrapper();
  });

  it('generates correct links', async () => {
    const {router} = createWrapper();
    await userEvent.click(screen.getByText('Test 1'));
    expect(router.location.pathname).toBe('/test1');
    await userEvent.click(screen.getByText('Test 2'));
    expect(router.location.pathname).toBe('/test2');
  });

  it('does not make links where no `to` is provided', async () => {
    const {router} = createWrapper();
    const initialPathname = router.location.pathname;
    await userEvent.click(screen.getByText('Test 3'));
    expect(router.location.pathname).toBe(initialPathname);
  });

  it('renders crumbs with openInNewTab as external links', () => {
    render(
      <Breadcrumbs
        crumbs={[
          {
            label: 'Issue Link',
            to: '/organizations/sentry/issues/123/',
            openInNewTab: true,
          },
          {
            label: 'Event Link',
            to: '/organizations/sentry/issues/123/events/456/',
            openInNewTab: true,
          },
          {
            label: 'Current',
          },
        ]}
      />
    );

    const links = screen.getAllByTestId('breadcrumb-link');
    expect(links).toHaveLength(2);

    expect(links[0]).toHaveAttribute('target', '_blank');
    expect(links[0]).toHaveAttribute('rel', 'noreferrer noopener');
    expect(links[0]).toHaveAttribute('href', expect.stringContaining('/issues/123/'));

    expect(links[1]).toHaveAttribute('target', '_blank');
    expect(links[1]).toHaveAttribute('rel', 'noreferrer noopener');
    expect(links[1]).toHaveAttribute(
      'href',
      expect.stringContaining('/issues/123/events/456/')
    );
  });
});
