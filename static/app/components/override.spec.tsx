import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {Override} from 'sentry/components/override';
import {getOverride, registerOverride} from 'sentry/overrideRegistry';

function OverrideWrapper(props: any) {
  return (
    <div data-test-id="override-wrapper">
      {props.children}
      <span>{JSON.stringify(props?.organization ?? {}, null, 2)}</span>
    </div>
  );
}

describe('Override', () => {
  it('renders component from an override', () => {
    registerOverride('sidebar:help-menu', ({organization}) => (
      <OverrideWrapper key={0} organization={organization}>
        {organization.slug}
      </OverrideWrapper>
    ));

    render(
      <div>
        <Override name="sidebar:help-menu" organization={OrganizationFixture()} />
      </div>
    );

    expect(getOverride('sidebar:help-menu')).toBeDefined();
    expect(screen.getByTestId('override-wrapper')).toBeInTheDocument();
    expect(screen.getByTestId('override-wrapper')).toHaveTextContent('org-slug');
  });

  it('picks up a new override when the registry is updated before re-render', () => {
    registerOverride('sidebar:help-menu', ({organization}) => (
      <OverrideWrapper key={0} organization={organization}>
        Old Hook
      </OverrideWrapper>
    ));

    const {rerender} = render(
      <Override name="sidebar:help-menu" organization={OrganizationFixture()} />
    );

    expect(screen.getByText(/Old Hook/)).toBeInTheDocument();

    registerOverride('sidebar:help-menu', () => (
      <OverrideWrapper key="new" organization={null}>
        New Hook
      </OverrideWrapper>
    ));

    rerender(<Override name="sidebar:help-menu" organization={OrganizationFixture()} />);

    expect(screen.getByText(/New Hook/)).toBeInTheDocument();
    expect(screen.queryByText(/Old Hook/)).not.toBeInTheDocument();
  });

  it('re-fetches overrides when name prop changes', () => {
    registerOverride('sidebar:help-menu', ({organization}) => (
      <OverrideWrapper key="help" organization={organization}>
        Help Hook
      </OverrideWrapper>
    ));

    registerOverride('sidebar:organization-dropdown-menu', () => (
      <OverrideWrapper key="bottom">Bottom Hook</OverrideWrapper>
    ));

    const {rerender} = render(
      <Override name="sidebar:help-menu" organization={OrganizationFixture()} />
    );

    expect(screen.getByText(/Help Hook/)).toBeInTheDocument();
    expect(screen.queryByText(/Bottom Hook/)).not.toBeInTheDocument();

    rerender(
      <Override
        name="sidebar:organization-dropdown-menu"
        organization={OrganizationFixture()}
      />
    );

    expect(screen.queryByText(/Help Hook/)).not.toBeInTheDocument();
    expect(screen.getByText(/Bottom Hook/)).toBeInTheDocument();
  });

  it('can use children as a render prop', () => {
    registerOverride('sidebar:help-menu', () => (
      <OverrideWrapper key="inner" organization={null}>
        Hook Content
      </OverrideWrapper>
    ));

    render(
      <Override name="sidebar:help-menu" organization={OrganizationFixture()}>
        {({rendered}) => <OverrideWrapper>{rendered} hook: 1</OverrideWrapper>}
      </Override>
    );

    expect(screen.getByText(/hook: 1/)).toBeInTheDocument();
    expect(screen.getByText(/Hook Content/)).toBeInTheDocument();
    // 2 OverrideWrappers: the render prop's outer wrapper + the hook's inner wrapper
    expect(screen.getAllByTestId('override-wrapper')).toHaveLength(2);
  });
});
