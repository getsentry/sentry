import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {BaseBadge} from 'sentry/components/idBadge/baseBadge';

describe('BadgeBadge', () => {
  it('has a display name', () => {
    render(
      <BaseBadge
        organization={OrganizationFixture()}
        displayName={<span>display name</span>}
      />
    );
    expect(screen.getByText('display name')).toBeInTheDocument();
  });

  it('can hide avatar', () => {
    render(
      <BaseBadge organization={OrganizationFixture()} displayName="hello" hideAvatar />
    );
    expect(screen.queryByTestId('badge-styled-avatar')).not.toBeInTheDocument();
    expect(screen.getByTestId('badge-display-name')).toHaveTextContent('hello');
  });

  it('can hide name', () => {
    render(
      <BaseBadge
        organization={OrganizationFixture()}
        hideName
        displayName={<span>display name</span>}
      />
    );
    expect(screen.queryByText('display name')).not.toBeInTheDocument();
  });
});
