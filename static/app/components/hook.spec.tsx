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
    HookStore.add('sidebar:help-menu', ({organization}) => (
      <HookWrapper key={0} organization={organization}>
        {organization.slug}
      </HookWrapper>
    ));

    render(
      <div>
        <Hook name="sidebar:help-menu" organization={OrganizationFixture()} />
      </div>
    );

    expect(HookStore.get('sidebar:help-menu')).toHaveLength(1);
    expect(screen.getByTestId('hook-wrapper')).toBeInTheDocument();
    expect(screen.getByTestId('hook-wrapper')).toHaveTextContent('org-slug');
  });

  it('can re-render when hooks get after initial render', () => {
    HookStore.add('sidebar:help-menu', ({organization}) => (
      <HookWrapper key={0} organization={organization}>
        Old Hook
      </HookWrapper>
    ));

    const {rerender} = render(
      <Hook name="sidebar:help-menu" organization={OrganizationFixture()} />
    );

    expect(screen.getByTestId('hook-wrapper')).toBeInTheDocument();

    act(() =>
      HookStore.add('sidebar:help-menu', () => (
        <HookWrapper key="new" organization={null}>
          New Hook
        </HookWrapper>
      ))
    );

    rerender(<Hook name="sidebar:help-menu" organization={OrganizationFixture()} />);

    expect(screen.getAllByTestId('hook-wrapper')).toHaveLength(2);
    expect(screen.getByText(/New Hook/)).toBeInTheDocument();
    expect(screen.getByText(/Old Hook/)).toBeInTheDocument();
  });

  it('re-fetches hooks when name prop changes', () => {
    HookStore.add('sidebar:help-menu', ({organization}) => (
      <HookWrapper key="help" organization={organization}>
        Help Hook
      </HookWrapper>
    ));

    HookStore.add('sidebar:organization-dropdown-menu', () => (
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
    let idx = 0;
    render(
      <Hook name="sidebar:help-menu" organization={OrganizationFixture()}>
        {({hooks}) =>
          hooks.map((hook, i) => (
            <HookWrapper key={i}>
              {hook} {`hook: ${++idx}`}
            </HookWrapper>
          ))
        }
      </Hook>
    );

    act(() =>
      HookStore.add('sidebar:help-menu', () => (
        <HookWrapper key="new" organization={null}>
          First Hook
        </HookWrapper>
      ))
    );

    act(() =>
      HookStore.add('sidebar:help-menu', () => (
        <HookWrapper key="new" organization={null}>
          Second Hook
        </HookWrapper>
      ))
    );

    for (let i = 0; i < idx; i++) {
      expect(screen.getByText(`hook: ${idx}`)).toBeInTheDocument();
    }

    // Has 2 Wrappers from store, and each is wrapped by another Wrapper
    expect(screen.getAllByTestId('hook-wrapper')).toHaveLength(4);
  });
});
