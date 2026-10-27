import type * as React from 'react';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {LinkButton} from '@sentry/scraps/button';
import {TrackingContextProvider} from '@sentry/scraps/trackingContext';

function renderWithTracking(ui: React.ReactElement) {
  const tracking = jest.fn();
  function TrackingWrapper({children}: {children: React.ReactNode}) {
    return <TrackingContextProvider value={tracking}>{children}</TrackingContextProvider>;
  }

  return {tracking, ...render(ui, {additionalWrapper: TrackingWrapper})};
}

describe('LinkButton app integration', () => {
  it('tracks internal links once and calls the click handler once', async () => {
    const onClick = jest.fn();
    const {tracking} = renderWithTracking(
      <LinkButton
        to="/organizations/org-slug/issues"
        onClick={onClick}
        analyticsEventKey="link_button.clicked"
      >
        Open
      </LinkButton>
    );

    await userEvent.click(screen.getByRole('button', {name: 'Open'}));

    expect(tracking).toHaveBeenCalledTimes(1);
    expect(tracking).toHaveBeenCalledWith(
      expect.objectContaining({
        analyticsEventKey: 'link_button.clicked',
        analyticsParams: {},
      })
    );
    expect(onClick).toHaveBeenCalledTimes(1);
  });
  it('renders react-router link', () => {
    render(<LinkButton to="/some/route">Router Link</LinkButton>);
  });
});
