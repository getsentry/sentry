import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {Pagination, useGetPaginationCaption} from '@sentry/scraps/pagination';
import {
  TranslationContextProvider,
  type TranslationContextValue,
} from '@sentry/scraps/translationContext';

const testTranslation: TranslationContextValue = {
  t: string => string,
  tct: (template, components) =>
    template
      .replace('[start]', components.start as string)
      .replace('[end]', components.end as string)
      .replace('[total]', components.total as string),
};

function PaginationCaption(props: {
  cursor: string | string[] | undefined | null;
  limit: number;
  pageLength: number;
  total: number;
}) {
  const getPaginationCaption = useGetPaginationCaption();
  return getPaginationCaption(props);
}

function renderPaginationCaption(props: React.ComponentProps<typeof PaginationCaption>) {
  return render(
    <TranslationContextProvider value={testTranslation}>
      <div>
        <PaginationCaption {...props} />
      </div>
    </TranslationContextProvider>
  );
}

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

describe('useGetPaginationCaption', () => {
  it('returns an empty string when pageLength is 0', () => {
    const {container} = renderPaginationCaption({
      cursor: undefined,
      limit: 25,
      pageLength: 0,
      total: 0,
    });
    expect(container).toHaveTextContent('');
  });

  it('formats the first page with no cursor', () => {
    const {container} = renderPaginationCaption({
      cursor: undefined,
      limit: 25,
      pageLength: 25,
      total: 100,
    });
    expect(container).toHaveTextContent('1-25 of 100');
  });

  it('uses the cursor offset to compute start/end', () => {
    const {container} = renderPaginationCaption({
      cursor: '0:2:0',
      limit: 25,
      pageLength: 25,
      total: 100,
    });
    expect(container).toHaveTextContent('51-75 of 100');
  });
});
