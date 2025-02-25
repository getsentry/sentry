import {render, screen} from 'sentry-test/reactTestingLibrary';

import FeatureBadge from 'sentry/components/badge/featureBadge';

describe('FeatureBadge', function () {
  it('auto-hides when expired', function () {
    const {rerender} = render(
      <FeatureBadge
        type="new"
        tooltipProps={{
          title: 'Something awesome',
        }}
        expiresAt={new Date(2018, 9, 16)}
      />
    );
    expect(screen.getByText('new')).toBeInTheDocument();
    rerender(
      <FeatureBadge
        type="new"
        tooltipProps={{
          title: 'Something awesome',
        }}
        expiresAt={new Date(2017, 9, 16)}
      />
    );
    expect(screen.queryByText('new')).not.toBeInTheDocument();
  });
  it('shows before expiry date', function () {
    // One hour from 'now'.
    const expires = new Date(Date.now() + 1000 * 60 * 60);
    render(
      <FeatureBadge
        type="new"
        tooltipProps={{
          title: 'Something awesome',
        }}
        expiresAt={expires}
      />
    );
    expect(screen.getByText('new')).toBeInTheDocument();
  });
});
