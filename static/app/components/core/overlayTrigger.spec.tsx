import {IconEllipsis} from '@sentry/icons/ellipsis';
import {expectTypeOf} from 'expect-type';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {DropdownMenu} from '@sentry/scraps/dropdownMenu';
import {Link} from '@sentry/scraps/link';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';
import {TrackingContextProvider} from '@sentry/scraps/trackingContext';

function LinkedMenu({
  variant,
  onLinkClick,
}: {
  onLinkClick: React.MouseEventHandler<HTMLAnchorElement>;
  variant: 'Button' | 'IconButton';
}) {
  return (
    <Link to="/queries/1/" onClick={onLinkClick}>
      <DropdownMenu
        items={[{key: 'duplicate', label: 'Duplicate query'}]}
        trigger={triggerProps =>
          variant === 'Button' ? (
            <OverlayTrigger.Button
              {...triggerProps}
              analyticsEventKey="query.actions"
              analyticsEventName="Query Actions"
              analyticsParams={{source: 'query-card'}}
            >
              Query actions
            </OverlayTrigger.Button>
          ) : (
            <OverlayTrigger.IconButton
              {...triggerProps}
              icon={<IconEllipsis />}
              aria-label="Query actions"
              analyticsEventKey="query.actions"
              analyticsEventName="Query Actions"
              analyticsParams={{source: 'query-card'}}
            />
          )
        }
      />
    </Link>
  );
}

describe.each(['Button', 'IconButton'] as const)('OverlayTrigger.%s', variant => {
  it('does not expose an onClick prop', () => {
    expectTypeOf<
      React.ComponentProps<(typeof OverlayTrigger)[typeof variant]>
    >().not.toHaveProperty('onClick');
  });

  it('opens the menu and tracks the click without activating the enclosing link', async () => {
    const onLinkClick = jest.fn();
    const trackClick = jest.fn();
    const {router} = render(
      <TrackingContextProvider value={trackClick}>
        <LinkedMenu variant={variant} onLinkClick={onLinkClick} />
      </TrackingContextProvider>,
      {initialRouterConfig: {location: {pathname: '/queries/'}}}
    );

    await userEvent.click(screen.getByRole('button', {name: 'Query actions'}));

    expect(await screen.findByRole('menu')).toBeInTheDocument();
    expect(onLinkClick).not.toHaveBeenCalled();
    expect(router.location.pathname).toBe('/queries/');
    expect(trackClick).toHaveBeenCalledTimes(1);
    expect(trackClick).toHaveBeenCalledWith(
      expect.objectContaining({
        clickType: 'button',
        analyticsEventKey: 'query.actions',
        analyticsEventName: 'Query Actions',
        analyticsParams: expect.objectContaining({source: 'query-card'}),
      })
    );
  });

  it.each(['{Enter}', ' '])(
    'opens the menu with %s without activating the enclosing link',
    async activation => {
      const onLinkClick = jest.fn();
      const {router} = render(
        <LinkedMenu variant={variant} onLinkClick={onLinkClick} />,
        {initialRouterConfig: {location: {pathname: '/queries/'}}}
      );

      await userEvent.tab();
      await userEvent.tab();
      expect(screen.getByRole('button', {name: 'Query actions'})).toHaveFocus();
      await userEvent.keyboard(activation);

      expect(await screen.findByRole('menu')).toBeInTheDocument();
      expect(onLinkClick).not.toHaveBeenCalled();
      expect(router.location.pathname).toBe('/queries/');
    }
  );
});
