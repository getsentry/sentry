import {OrganizationFixture} from 'sentry-fixture/organization';

import {act, render, screen} from 'sentry-test/reactTestingLibrary';

import Hook from 'sentry/components/hook';
import {HookStore} from 'sentry/stores/hookStore';

function HookWrapper(props: any) {
  return (
    <div data-test-id="hook-wrapper">
      {props.children}
      <span>{JSON.stringify(props?.organization ?? {}, null, 2)}</span>
    </div>
  );
}

describe('Hook', () => {
  afterEach(() => {
    HookStore.init();
  });

  it('renders component from a hook', () => {
    HookStore.set('sidebar:help-menu', ({organization}) => (
      <HookWrapper key={0} organization={organization}>
        {organization.slug}
      </HookWrapper>
    ));

    render(
      <div>
        <Hook name="sidebar:help-menu" organization={OrganizationFixture()} />
      </div>
    );

    expect(HookStore.get('sidebar:help-menu')).toBeDefined();
    expect(screen.getByTestId('hook-wrapper')).toBeInTheDocument();
    expect(screen.getByTestId('hook-wrapper')).toHaveTextContent('org-slug');
  });

  it('re-renders when hook is replaced after initial render', () => {
    HookStore.set('sidebar:help-menu', ({organization}) => (
      <HookWrapper key={0} organization={organization}>
        Old Hook
      </HookWrapper>
    ));

    const {rerender} = render(
      <Hook name="sidebar:help-menu" organization={OrganizationFixture()} />
    );

    expect(screen.getByTestId('hook-wrapper')).toBeInTheDocument();

    act(() =>
      HookStore.set('sidebar:help-menu', () => (
        <HookWrapper key="new" organization={null}>
          New Hook
        </HookWrapper>
      ))
    );

    rerender(<Hook name="sidebar:help-menu" organization={OrganizationFixture()} />);

    expect(screen.getAllByTestId('hook-wrapper')).toHaveLength(1);
    expect(screen.getByText(/New Hook/)).toBeInTheDocument();
    expect(screen.queryByText(/Old Hook/)).not.toBeInTheDocument();
  });

  it('re-fetches hooks when name prop changes', () => {
    HookStore.set('sidebar:help-menu', ({organization}) => (
      <HookWrapper key="help" organization={organization}>
        Help Hook
      </HookWrapper>
    ));

    HookStore.set('sidebar:organization-dropdown-menu', () => (
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
    render(
      <Hook name="sidebar:help-menu" organization={OrganizationFixture()}>
        {({rendered}) => <HookWrapper>{rendered} hook: 1</HookWrapper>}
      </Hook>
    );

    act(() =>
      HookStore.set('sidebar:help-menu', () => (
        <HookWrapper key="new" organization={null}>
          First Hook
        </HookWrapper>
      ))
    );

    act(() =>
      HookStore.set('sidebar:help-menu', () => (
        <HookWrapper key="new" organization={null}>
          Second Hook
        </HookWrapper>
      ))
    );

    expect(screen.getByText(/hook: 1/)).toBeInTheDocument();
    expect(screen.getByText(/Second Hook/)).toBeInTheDocument();
    expect(screen.queryByText(/First Hook/)).not.toBeInTheDocument();

    // 2 HookWrappers: the render prop's outer wrapper + the registered hook's inner wrapper
    expect(screen.getAllByTestId('hook-wrapper')).toHaveLength(2);
  });
});
