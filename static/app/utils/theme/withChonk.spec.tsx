import {createRef} from 'react';
import {ConfigFixture} from 'sentry-fixture/config';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {UserFixture} from 'sentry-fixture/user';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {ThemeAndStyleProvider} from 'sentry/components/themeAndStyleProvider';
import ConfigStore from 'sentry/stores/configStore';
import OrganizationStore from 'sentry/stores/organizationStore';
import type {Theme} from 'sentry/utils/theme';

import {withChonk} from './withChonk';

function ChonkComponent() {
  return <div>Chonk: {'true'}</div>;
}
function ChonkComponentWithRef({ref}: {theme: Theme; ref?: React.Ref<HTMLDivElement>}) {
  return <div ref={ref}>Chonk: {'true'}</div>;
}

describe('withChonk', () => {
  beforeEach(() => {
    ConfigStore.loadInitialData(
      ConfigFixture({
        user: UserFixture({
          options: {...UserFixture().options},
        }),
      })
    );
    OrganizationStore.onUpdate(OrganizationFixture({features: []}));
  });

  it('renders chonk component when chonk is enabled', () => {
    ConfigStore.loadInitialData(
      ConfigFixture({
        user: UserFixture({
          options: {...UserFixture().options},
        }),
      })
    );

    OrganizationStore.onUpdate(
      OrganizationFixture({
        features: ['chonk-ui'],
      })
    );

    const Component = withChonk(
      () => <div />,
      ChonkComponent,
      props => props
    );

    render(
      <ThemeAndStyleProvider>
        <Component />
      </ThemeAndStyleProvider>
    );

    expect(screen.getByText(/Chonk: true/)).toBeInTheDocument();
  });

  it('passes ref to chonk component', () => {
    ConfigStore.loadInitialData(
      ConfigFixture({
        user: UserFixture({
          options: {...UserFixture().options},
        }),
      })
    );

    OrganizationStore.onUpdate(
      OrganizationFixture({
        features: ['chonk-ui'],
      })
    );

    const ref = createRef<HTMLDivElement>();
    const Component = withChonk(
      () => <div />,
      ChonkComponentWithRef,
      props => props
    );

    render(
      <ThemeAndStyleProvider>
        <Component ref={ref} />
      </ThemeAndStyleProvider>
    );
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
    expect(screen.getByText(/Chonk: true/)).toBeInTheDocument();
  });
});
