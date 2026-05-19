import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import Hook from 'sentry/components/hook';
import {getHook, registerHook} from 'sentry/hookRegistry';

function HookWrapper(props: any) {
  return (
    <div data-test-id="hook-wrapper">
      {props.children}
      <span>{JSON.stringify(props?.organization ?? {}, null, 2)}</span>
    </div>
  );
}

describe('Hook', () => {
  it('renders component from a hook', () => {
    registerHook('sidebar:help-menu', ({organization}) => (
      <HookWrapper key={0} organization={organization}>
        {organization.slug}
      </HookWrapper>
    ));

    render(
      <div>
        <Hook name="sidebar:help-menu" organization={OrganizationFixture()} />
      </div>
    );

    expect(getHook('sidebar:help-menu')).toBeDefined();
    expect(screen.getByTestId('hook-wrapper')).toBeInTheDocument();
    expect(screen.getByTestId('hook-wrapper')).toHaveTextContent('org-slug');
  });

  it('picks up a new hook when the registry is updated before re-render', () => {
    registerHook('sidebar:help-menu', ({organization}) => (
      <HookWrapper key={0} organization={organization}>
        Old Hook
      </HookWrapper>
    ));

    const {rerender} = render(
      <Hook name="sidebar:help-menu" organization={OrganizationFixture()} />
    );

    expect(screen.getByText(/Old Hook/)).toBeInTheDocument();

    registerHook('sidebar:help-menu', () => (
      <HookWrapper key="new" organization={null}>
        New Hook
      </HookWrapper>
    ));

    rerender(<Hook name="sidebar:help-menu" organization={OrganizationFixture()} />);

    expect(screen.getByText(/New Hook/)).toBeInTheDocument();
    expect(screen.queryByText(/Old Hook/)).not.toBeInTheDocument();
  });

  it('re-fetches hooks when name prop changes', () => {
    registerHook('sidebar:help-menu', ({organization}) => (
      <HookWrapper key="help" organization={organization}>
        Help Hook
      </HookWrapper>
    ));

    registerHook('sidebar:organization-dropdown-menu', () => (
      <HookWrapper key="bottom">Bottom Hook</HookWrapper>
    ));

    const {rerender} = render(
      <Hook name="sidebar:help-menu" organization={OrganizationFixture()} />
    );

    expect(screen.getByText(/Help Hook/)).toBeInTheDocument();
    expect(screen.queryByText(/Bottom Hook/)).not.toBeInTheDocument();

    rerender(
      <Hook
        name="sidebar:organization-dropdown-menu"
        organization={OrganizationFixture()}
      />
    );

    expect(screen.queryByText(/Help Hook/)).not.toBeInTheDocument();
    expect(screen.getByText(/Bottom Hook/)).toBeInTheDocument();
  });

  it('can use children as a render prop', () => {
    registerHook('sidebar:help-menu', () => (
      <HookWrapper key="inner" organization={null}>
        Hook Content
      </HookWrapper>
    ));

    render(
      <Hook name="sidebar:help-menu" organization={OrganizationFixture()}>
        {({rendered}) => <HookWrapper>{rendered} hook: 1</HookWrapper>}
      </Hook>
    );

    expect(screen.getByText(/hook: 1/)).toBeInTheDocument();
    expect(screen.getByText(/Hook Content/)).toBeInTheDocument();
    // 2 HookWrappers: the render prop's outer wrapper + the hook's inner wrapper
    expect(screen.getAllByTestId('hook-wrapper')).toHaveLength(2);
  });
});
