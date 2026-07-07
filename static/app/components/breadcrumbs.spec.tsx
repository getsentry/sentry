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

  it('renders non-string (React node) labels', () => {
    // Many call sites pass rich content as the current crumb — e.g. an editable
    // name field. The shim must render it as-is, not coerce it away.
    render(
      <Breadcrumbs
        crumbs={[
          {label: 'Parent', to: '/parent'},
          {label: <button type="button">Editable Name</button>, to: null},
        ]}
      />
    );

    expect(screen.getByRole('button', {name: 'Editable Name'})).toBeInTheDocument();
  });
});
