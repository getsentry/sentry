import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {Pagination, getPaginationCaption} from '@sentry/scraps/pagination';

const pageLinks =
  '<http://localhost/api/0/items/?cursor=0:0:1>; rel="previous"; results="true"; cursor="0:0:1", ' +
  '<http://localhost/api/0/items/?cursor=0:25:0>; rel="next"; results="true"; cursor="0:25:0"';

const noPreviousLinks =
  '<http://localhost/api/0/items/?cursor=0:0:1>; rel="previous"; results="false"; cursor="0:0:1", ' +
  '<http://localhost/api/0/items/?cursor=0:25:0>; rel="next"; results="true"; cursor="0:25:0"';

const noNextLinks =
  '<http://localhost/api/0/items/?cursor=0:0:1>; rel="previous"; results="true"; cursor="0:0:1", ' +
  '<http://localhost/api/0/items/?cursor=0:25:0>; rel="next"; results="false"; cursor="0:25:0"';

describe('Pagination', () => {
  it('renders nothing when pageLinks is undefined', () => {
    const {container} = render(<Pagination />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when pageLinks is null', () => {
    const {container} = render(<Pagination pageLinks={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders Previous and Next controls', () => {
    render(<Pagination pageLinks={pageLinks} />);
    expect(screen.getByRole('button', {name: 'Previous'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Next'})).toBeInTheDocument();
  });

  it('disables Previous when the previous link reports results=false', () => {
    render(<Pagination pageLinks={noPreviousLinks} />);
    expect(screen.getByRole('button', {name: 'Previous'})).toBeDisabled();
    expect(screen.getByRole('button', {name: 'Next'})).toBeEnabled();
  });

  it('disables Next when the next link reports results=false', () => {
    render(<Pagination pageLinks={noNextLinks} />);
    expect(screen.getByRole('button', {name: 'Previous'})).toBeEnabled();
    expect(screen.getByRole('button', {name: 'Next'})).toBeDisabled();
  });

  it('disables both controls when disabled prop is set', () => {
    render(<Pagination pageLinks={pageLinks} disabled />);
    expect(screen.getByRole('button', {name: 'Previous'})).toBeDisabled();
    expect(screen.getByRole('button', {name: 'Next'})).toBeDisabled();
  });

  it('navigates with the cursor merged into the current query by default', async () => {
    const {router} = render(<Pagination pageLinks={pageLinks} />, {
      initialRouterConfig: {
        location: {pathname: '/items/', query: {foo: 'bar'}},
      },
    });

    await userEvent.click(screen.getByRole('button', {name: 'Next'}));

    expect(router.location.pathname).toBe('/items/');
    expect(router.location.query).toEqual({foo: 'bar', cursor: '0:25:0'});
  });

  it('uses the to prop to override the default pathname', async () => {
    const {router} = render(<Pagination pageLinks={pageLinks} to="/other/" />, {
      initialRouterConfig: {location: {pathname: '/items/'}},
    });

    await userEvent.click(screen.getByRole('button', {name: 'Next'}));

    expect(router.location.pathname).toBe('/other/');
    expect(router.location.query.cursor).toBe('0:25:0');
  });

  it('calls custom onCursor with (cursor, path, query, delta)', async () => {
    const onCursor = jest.fn();
    render(<Pagination pageLinks={pageLinks} onCursor={onCursor} />, {
      initialRouterConfig: {
        location: {pathname: '/items/', query: {foo: 'bar'}},
      },
    });

    await userEvent.click(screen.getByRole('button', {name: 'Next'}));
    expect(onCursor).toHaveBeenCalledWith('0:25:0', '/items/', {foo: 'bar'}, 1);

    await userEvent.click(screen.getByRole('button', {name: 'Previous'}));
    expect(onCursor).toHaveBeenCalledWith('0:0:1', '/items/', {foo: 'bar'}, -1);
  });

  it('fires paginationAnalyticsEvent with the direction', async () => {
    const paginationAnalyticsEvent = jest.fn();
    render(
      <Pagination
        pageLinks={pageLinks}
        paginationAnalyticsEvent={paginationAnalyticsEvent}
      />
    );

    await userEvent.click(screen.getByRole('button', {name: 'Next'}));
    expect(paginationAnalyticsEvent).toHaveBeenCalledWith('Next');

    await userEvent.click(screen.getByRole('button', {name: 'Previous'}));
    expect(paginationAnalyticsEvent).toHaveBeenCalledWith('Previous');
  });

  it('renders the caption when provided', () => {
    render(<Pagination pageLinks={pageLinks} caption="1-25 of 100" />);
    expect(screen.getByText('1-25 of 100')).toBeInTheDocument();
  });
});

describe('getPaginationCaption', () => {
  it('returns an empty string when pageLength is 0', () => {
    expect(
      getPaginationCaption({cursor: undefined, limit: 25, pageLength: 0, total: 0})
    ).toBe('');
  });

  it('formats the first page with no cursor', () => {
    const {container} = render(
      <div>
        {getPaginationCaption({
          cursor: undefined,
          limit: 25,
          pageLength: 25,
          total: 100,
        })}
      </div>
    );
    expect(container).toHaveTextContent('1-25 of 100');
  });

  it('uses the cursor offset to compute start/end', () => {
    const {container} = render(
      <div>
        {getPaginationCaption({
          cursor: '0:2:0',
          limit: 25,
          pageLength: 25,
          total: 100,
        })}
      </div>
    );
    expect(container).toHaveTextContent('51-75 of 100');
  });
});
