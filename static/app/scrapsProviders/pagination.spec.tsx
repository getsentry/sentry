import {ThemeProvider} from '@emotion/react';
import {render as renderWithoutRouter} from '@testing-library/react'; // eslint-disable-line no-restricted-imports

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {Pagination} from '@sentry/scraps/pagination';
import {lightTheme} from '@sentry/scraps/theme';
import {
  TranslationContextProvider,
  type TranslationContextValue,
} from '@sentry/scraps/translation';

import {getPaginationProps, useGetPaginationCaption} from 'sentry/utils/pagination';

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
    const {container} = render(<Pagination {...getPaginationProps(null)} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders Previous and Next controls', () => {
    render(<Pagination {...getPaginationProps(pageLinks)} />);
    expect(screen.getByRole('button', {name: 'Previous'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Next'})).toBeInTheDocument();
  });

  it('disables Previous when the previous link reports results=false', () => {
    render(<Pagination {...getPaginationProps(noPreviousLinks)} />);
    expect(screen.getByRole('button', {name: 'Previous'})).toBeDisabled();
    expect(screen.getByRole('button', {name: 'Next'})).toBeEnabled();
  });

  it('disables Next when the next link reports results=false', () => {
    render(<Pagination {...getPaginationProps(noNextLinks)} />);
    expect(screen.getByRole('button', {name: 'Previous'})).toBeEnabled();
    expect(screen.getByRole('button', {name: 'Next'})).toBeDisabled();
  });

  it('disables both controls when disabled prop is set', () => {
    render(<Pagination {...getPaginationProps(pageLinks)} disabled />);
    expect(screen.getByRole('button', {name: 'Previous'})).toBeDisabled();
    expect(screen.getByRole('button', {name: 'Next'})).toBeDisabled();
  });

  it('navigates with the cursor merged into the current query by default', async () => {
    const onNuqsUrlUpdate = jest.fn();
    const {router} = render(<Pagination {...getPaginationProps(pageLinks)} />, {
      onNuqsUrlUpdate,
      initialRouterConfig: {
        location: {pathname: '/items/', query: {foo: 'bar', project: ['1', '2']}},
      },
    });

    await userEvent.click(screen.getByRole('button', {name: 'Next'}));

    await waitFor(() => {
      expect(router.location.query).toEqual({
        foo: 'bar',
        project: ['1', '2'],
        cursor: '0:25:0',
      });
    });
    expect(router.location.pathname).toBe('/items/');
    expect(onNuqsUrlUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({history: 'push', shallow: false}),
      })
    );

    router.navigate(-1);
    await waitFor(() => {
      expect(router.location.query).toEqual({foo: 'bar', project: ['1', '2']});
    });
  });

  it('removes the cursor when navigating to a link without one', async () => {
    const {router} = render(
      <Pagination
        {...getPaginationProps(
          '<http://localhost/api/0/items/>; rel="previous"; results="true"'
        )}
      />,
      {
        initialRouterConfig: {
          location: {pathname: '/items/', query: {foo: 'bar', cursor: '0:25:0'}},
        },
      }
    );

    await userEvent.click(screen.getByRole('button', {name: 'Previous'}));
    await waitFor(() => expect(router.location.query).toEqual({foo: 'bar'}));
  });

  it('uses a custom cursor handler instead of default navigation', async () => {
    const onCursor = jest.fn();
    const {router} = render(
      <Pagination {...getPaginationProps(pageLinks)} onCursor={onCursor} />,
      {
        initialRouterConfig: {
          location: {pathname: '/items/', query: {foo: 'bar'}},
        },
      }
    );

    await userEvent.click(screen.getByRole('button', {name: 'Next'}));
    expect(onCursor).toHaveBeenCalledWith('0:25:0', 1);

    await userEvent.click(screen.getByRole('button', {name: 'Previous'}));
    expect(onCursor).toHaveBeenCalledWith('0:0:1', -1);
    expect(router.location.query).toEqual({foo: 'bar'});
  });

  it('observes page changes without overriding URL navigation', async () => {
    const paginationAnalyticsEvent = jest.fn();
    const {router} = render(
      <Pagination
        {...getPaginationProps(pageLinks)}
        onPageChange={(_cursor, delta) =>
          paginationAnalyticsEvent(delta === -1 ? 'Previous' : 'Next')
        }
      />
    );

    await userEvent.click(screen.getByRole('button', {name: 'Next'}));
    expect(paginationAnalyticsEvent).toHaveBeenCalledWith('Next');
    await waitFor(() => expect(router.location.query.cursor).toBe('0:25:0'));

    await userEvent.click(screen.getByRole('button', {name: 'Previous'}));
    expect(paginationAnalyticsEvent).toHaveBeenCalledWith('Previous');
  });

  it('renders the caption when provided', () => {
    render(<Pagination {...getPaginationProps(pageLinks)} caption="1-25 of 100" />);
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

it('uses a custom cursor handler without a router', async () => {
  const onCursor = jest.fn();
  renderWithoutRouter(
    <ThemeProvider theme={lightTheme}>
      <Pagination {...getPaginationProps(pageLinks)} onCursor={onCursor} />
    </ThemeProvider>
  );
  await userEvent.click(screen.getByRole('button', {name: 'Next'}));
  expect(onCursor).toHaveBeenCalledWith('0:25:0', 1);
});
