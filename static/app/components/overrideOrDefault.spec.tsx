import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {registerOverride} from 'sentry/overrideRegistry';

import {OverrideOrDefault} from './overrideOrDefault';

describe('OverrideOrDefault', () => {
  it('should render default', () => {
    const Component = OverrideOrDefault({
      overrideName: 'component:replay-onboarding-cta',
      defaultComponent: () => (
        <div data-test-id="default-component">Default Component</div>
      ),
    });

    render(<Component organization={OrganizationFixture()}>Test</Component>);
    expect(screen.getByTestId('default-component')).toBeInTheDocument();
    expect(screen.getByText('Default Component')).toBeInTheDocument();
  });

  it('should render from override registry', () => {
    registerOverride(
      'component:replay-onboarding-cta',
      () =>
        function ({organization}) {
          return <div data-test-id="override-component">{organization.slug}</div>;
        }
    );

    const Component = OverrideOrDefault({
      overrideName: 'component:replay-onboarding-cta',
      defaultComponent: () => (
        <div data-test-id="default-component">Default Component</div>
      ),
    });

    render(<Component organization={OrganizationFixture()}>Test</Component>);

    expect(screen.getByTestId('override-component')).toBeInTheDocument();
    expect(screen.queryByTestId('default-component')).not.toBeInTheDocument();
    expect(screen.getByText('org-slug')).toBeInTheDocument();
  });
});
