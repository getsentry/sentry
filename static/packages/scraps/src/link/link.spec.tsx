import type * as React from 'react';
import {createRef} from 'react';
import {ThemeProvider} from '@emotion/react';
import {render, screen} from '@testing-library/react';
import {userEvent} from '@testing-library/user-event';

import {darkTheme, lightTheme} from '@sentry/scraps/theme';
import {TrackingContextProvider} from '@sentry/scraps/trackingContext';

import {ExternalLink, Link, type LinkProps} from './link';
import {LinkBehaviorContextProvider} from './linkBehaviorContext';

function ThemeWrapper({children}: {children: React.ReactNode}) {
  return <ThemeProvider theme={lightTheme}>{children}</ThemeProvider>;
}

describe('Link without a router', () => {
  it.each<[LinkProps['to'], string]>([
    ['/issues/?query=error#details', '/issues/?query=error#details'],
    ['https://example.com/', 'https://example.com/'],
    ['../settings/', '../settings/'],
    [
      {pathname: '/issues/', search: '?query=error', hash: '#details'},
      '/issues/?query=error#details',
    ],
    [
      {pathname: '/issues/', search: 'query=error', hash: 'details'},
      '/issues/?query=error#details',
    ],
    [{hash: 'details'}, '#details'],
    [{query: {query: 'is:unresolved'}}, '?query=is%3Aunresolved'],
    [{pathname: '/issues/', search: '?old=true', query: {}}, '/issues/'],
    [
      {
        pathname: '/issues/',
        search: '?old=true',
        query: {tag: ['one', 'two'], flag: null, absent: undefined},
      },
      '/issues/?flag&tag=one&tag=two',
    ],
  ])('renders %j as %s', (to, href) => {
    render(<Link to={to}>Issues</Link>, {wrapper: ThemeWrapper});
    expect(screen.getByRole('link', {name: 'Issues'})).toHaveAttribute('href', href);
  });

  it('forwards refs and filters router-only props', () => {
    const ref = createRef<HTMLAnchorElement>();
    render(
      <Link
        ref={ref}
        to="/issues/"
        replace
        preventScrollReset
        reloadDocument
        state={{source: 'test'}}
      >
        Issues
      </Link>,
      {wrapper: ThemeWrapper}
    );
    const link = screen.getByRole('link', {name: 'Issues'});
    expect(ref.current).toBe(link);
    for (const attribute of [
      'to',
      'replace',
      'preventScrollReset',
      'reloadDocument',
      'state',
    ]) {
      expect(link).not.toHaveAttribute(attribute);
    }
  });

  it('tracks clicks and calls the consumer once', async () => {
    const tracking = jest.fn();
    const onClick = jest.fn((event: React.MouseEvent) => event.preventDefault());
    render(
      <TrackingContextProvider value={tracking}>
        <Link
          to="/issues/"
          onClick={onClick}
          analyticsEventKey="issues.open"
          analyticsParams={{source: 'test'}}
        >
          Issues
        </Link>
      </TrackingContextProvider>,
      {wrapper: ThemeWrapper}
    );
    const link = screen.getByRole('link', {name: 'Issues'});
    await userEvent.click(link);
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(tracking).toHaveBeenCalledTimes(1);
    expect(tracking).toHaveBeenCalledWith(
      expect.objectContaining({
        clickType: 'link',
        'aria-label': 'Issues',
        analyticsEventKey: 'issues.open',
        analyticsParams: {source: 'test'},
      })
    );
    expect(link).not.toHaveAttribute('analyticsEventKey');
    expect(link).not.toHaveAttribute('analyticsParams');
  });

  it.each<LinkProps['to']>([
    'https://example.com/',
    {pathname: '/issues/', query: {query: 'error'}},
  ])('removes the disabled destination %j', to => {
    render(
      <Link disabled to={to}>
        Issues
      </Link>,
      {wrapper: ThemeWrapper}
    );
    const link = screen.getByText('Issues');
    expect(link).toBeEnabled();
    expect(link).not.toHaveAttribute('href');
    expect(link).not.toHaveAttribute('to');
  });
});

describe('Link with a supplied behavior', () => {
  it('uses the supplied component and keeps behavior-added handlers', async () => {
    const onClick = jest.fn((event: React.MouseEvent) => event.preventDefault());
    const onFocus = jest.fn();
    function CustomLink({to: _to, replace, state, ...props}: LinkProps) {
      return (
        <a
          {...props}
          href="/normalized/"
          data-replace={String(replace)}
          data-state={JSON.stringify(state)}
        />
      );
    }
    render(
      <LinkBehaviorContextProvider
        value={{component: CustomLink, behavior: props => ({...props, onFocus})}}
      >
        <Link to="/issues/" replace state={{source: 'test'}} onClick={onClick}>
          Issues
        </Link>
      </LinkBehaviorContextProvider>,
      {wrapper: ThemeWrapper}
    );
    const link = screen.getByRole('link', {name: 'Issues'});
    expect(link).toHaveAttribute('href', '/normalized/');
    expect(link).toHaveAttribute('data-replace', 'true');
    expect(link).toHaveAttribute('data-state', '{"source":"test"}');
    await userEvent.tab();
    expect(onFocus).toHaveBeenCalledTimes(1);
    await userEvent.click(link);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe('ExternalLink', () => {
  it.each([undefined, true, false])(
    'sets secure new-tab attributes when openInNewTab is %s',
    openInNewTab => {
      render(
        <ExternalLink href="https://example.com" openInNewTab={openInNewTab}>
          External
        </ExternalLink>,
        {wrapper: ThemeWrapper}
      );
      const link = screen.getByRole('link', {name: 'External'});
      expect(link).toHaveAttribute('href', 'https://example.com');
      if (openInNewTab === false) {
        expect(link).not.toHaveAttribute('target');
        expect(link).not.toHaveAttribute('rel');
      } else {
        expect(link).toHaveAttribute('target', '_blank');
        expect(link).toHaveAttribute('rel', 'noreferrer noopener');
      }
    }
  );
});

describe('Link color', () => {
  it.each([
    ['light', lightTheme],
    ['dark', darkTheme],
  ])('uses the link color of the nearest %s theme', (_name, theme) => {
    render(
      <ThemeProvider theme={theme}>
        <ExternalLink href="https://example.com/">Docs</ExternalLink>
      </ThemeProvider>
    );

    expect(screen.getByRole('link', {name: 'Docs'})).toHaveStyle({
      color: theme.tokens.interactive.link.accent.rest,
    });
  });
});
