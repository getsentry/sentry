import {Organization} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import HookStore from 'sentry/stores/hookStore';

import HookOrDefault from './hookOrDefault';

describe('HookOrDefault', () => {
  beforeEach(() => {
    HookStore.init();
  });

  it('should render default', () => {
    const Component = HookOrDefault({
      hookName: 'component:replay-onboarding-cta',
      defaultComponent: () => (
        <div data-test-id="default-component">Default Component</div>
      ),
    });

    render(<Component organization={Organization()}>Test</Component>);
    expect(screen.getByTestId('default-component')).toBeInTheDocument();
    expect(screen.getByText('Default Component')).toBeInTheDocument();
  });

  it('should render from HookStore', () => {
    HookStore.add(
      'component:replay-onboarding-cta',
      () =>
        function ({organization}) {
          return <div data-test-id="hook-component">{organization.slug}</div>;
        }
    );

    const Component = HookOrDefault({
      hookName: 'component:replay-onboarding-cta',
      defaultComponent: () => (
        <div data-test-id="default-component">Default Component</div>
      ),
    });

    render(<Component organization={Organization()}>Test</Component>);

    expect(screen.getByTestId('hook-component')).toBeInTheDocument();
    expect(screen.queryByTestId('default-component')).not.toBeInTheDocument();
    expect(screen.getByText('org-slug')).toBeInTheDocument();
  });
});
