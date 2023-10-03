import {Organization} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import BaseBadge from 'sentry/components/idBadge/baseBadge';

describe('BadgeBadge', function () {
  it('has a display name', function () {
    render(
      <BaseBadge organization={Organization()} displayName={<span>display name</span>} />
    );
    expect(screen.getByText('display name')).toBeInTheDocument();
  });

  it('can hide avatar', function () {
    render(<BaseBadge organization={Organization()} displayName="hello" hideAvatar />);
    expect(screen.queryByTestId('badge-styled-avatar')).not.toBeInTheDocument();
    expect(screen.getByTestId('badge-display-name')).toHaveTextContent('hello');
  });

  it('can hide name', function () {
    render(
      <BaseBadge
        organization={Organization()}
        hideName
        displayName={<span>display name</span>}
      />
    );
    expect(screen.queryByText('display name')).not.toBeInTheDocument();
  });
});
