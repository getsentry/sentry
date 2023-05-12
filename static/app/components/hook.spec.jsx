import {render, screen} from 'sentry-test/reactTestingLibrary';

import Hook from 'sentry/components/hook';
import HookStore from 'sentry/stores/hookStore';

function HookWrapper(props) {
  return (
    <div data-test-id="hook-wrapper">
      {props.children}
      <span>{JSON.stringify(props?.organization ?? {}, null, 2)}</span>
    </div>
  );
}

describe('Hook', function () {
  afterEach(function () {
    HookStore.init();
  });

  it('renders component from a hook', function () {
    HookStore.add('footer', ({organization} = {}) => (
      <HookWrapper key={0} organization={organization}>
        {organization.slug}
      </HookWrapper>
    ));

    render(
      <div>
        <Hook name="footer" organization={TestStubs.Organization()} />
      </div>
    );

    expect(HookStore.hooks.footer).toHaveLength(1);
    expect(screen.getByTestId('hook-wrapper')).toBeInTheDocument();
    expect(screen.getByTestId('hook-wrapper')).toHaveTextContent('org-slug');
  });

  it('renders an invalid hook', function () {
    HookStore.add('footer', ({organization} = {}) => (
      <HookWrapper key={0} organization={organization}>
        {organization.slug}
      </HookWrapper>
    ));

    render(
      <div>
        <Hook name="invalid-hook" organization={TestStubs.Organization()} />
        invalid
      </div>
    );

    expect(screen.queryByText('org-slug')).not.toBeInTheDocument();
    expect(screen.getByText('invalid')).toBeInTheDocument();
  });

  it('can re-render when hooks get after initial render', function () {
    HookStore.add('footer', ({organization} = {}) => (
      <HookWrapper key={0} organization={organization}>
        Old Hook
      </HookWrapper>
    ));

    const {rerender} = render(
      <Hook name="footer" organization={TestStubs.Organization()} />
    );

    expect(screen.getByTestId('hook-wrapper')).toBeInTheDocument();

    HookStore.add('footer', () => (
      <HookWrapper key="new" organization={null}>
        New Hook
      </HookWrapper>
    ));

    rerender(<Hook name="footer" organization={TestStubs.Organization()} />);

    expect(screen.getAllByTestId('hook-wrapper')).toHaveLength(2);
    expect(screen.getByText(/New Hook/)).toBeInTheDocument();
    expect(screen.getByText(/Old Hook/)).toBeInTheDocument();
  });

  it('can use children as a render prop', function () {
    let idx = 0;
    render(
      <Hook name="footer" organization={TestStubs.Organization()}>
        {({hooks}) =>
          hooks.map((hook, i) => (
            <HookWrapper key={i}>
              {hook} {`hook: ${++idx}`}
            </HookWrapper>
          ))
        }
      </Hook>
    );

    HookStore.add('footer', () => (
      <HookWrapper key="new" organization={null}>
        First Hook
      </HookWrapper>
    ));

    HookStore.add('footer', () => (
      <HookWrapper key="new" organization={null}>
        Second Hook
      </HookWrapper>
    ));

    for (let i = 0; i < idx; i++) {
      expect(screen.getByText(`hook: ${idx}`)).toBeInTheDocument();
    }

    // Has 2 Wrappers from store, and each is wrapped by another Wrapper
    expect(screen.getAllByTestId('hook-wrapper')).toHaveLength(4);
  });
});
