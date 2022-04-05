import {Fragment} from 'react';

import {act, render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import LegacyConfigStore from 'sentry/stores/configStore';
import {ConfigProvider} from 'sentry/stores/configStore/configProvider';
import {useConfig} from 'sentry/stores/configStore/useConfig';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';

const ReactContextSourceComponent = ({children}: {children?: React.ReactNode}) => {
  const [config] = useConfig();
  return (
    <Fragment>
      React: {config.dsn}
      <div>{children ?? null}</div>
    </Fragment>
  );
};

const LegacyStoreSourceComponent = ({children}: {children?: React.ReactNode}) => {
  const config = useLegacyStore(LegacyConfigStore);
  return (
    <Fragment>
      Reflux: {config.dsn}
      <div>{children ?? null}</div>
    </Fragment>
  );
};

describe('configProvider', () => {
  beforeEach(() => {
    LegacyConfigStore.init();
  });
  afterEach(() => {
    LegacyConfigStore.teardown();
  });
  it('initializes with initial value', () => {
    render(
      <ConfigProvider initialValue={TestStubs.Config({dsn: 'custom dsn'})}>
        <ReactContextSourceComponent />
      </ConfigProvider>
    );

    expect(screen.getByText(/custom dsn/)).toBeInTheDocument();
  });
  it('updates React component when reflux action fires', async () => {
    // We are rendering a component that gets its data from the react context, firing
    // an action on ouron the store and asserting that it gets updated in our component
    render(
      <ConfigProvider initialValue={TestStubs.Config({dsn: 'custom dsn'})} bridgeReflux>
        <ReactContextSourceComponent />
      </ConfigProvider>
    );

    act(() => LegacyConfigStore.set('dsn', 'new custom dsn'));
    expect(await screen.findByText(/new custom dsn/)).toBeInTheDocument();
  });

  it('updates Legacy component when context action is dispatched', async () => {
    // We are rendering a component that gets its data from the react context, firing
    // an action via reducer dispatch and asserting that it gets updated in a component
    // that uses the legacy store
    function Trigger() {
      const [_, dispatch] = useConfig();

      return (
        <button
          onClick={() => {
            dispatch({
              type: 'set config value',
              payload: {key: 'dsn', value: 'new custom dsn'},
            });
          }}
        >
          Trigger
        </button>
      );
    }

    const config = TestStubs.Config({dsn: 'custom dsn'});
    render(
      <ConfigProvider initialValue={config} bridgeReflux>
        <LegacyStoreSourceComponent>
          <Trigger />
        </LegacyStoreSourceComponent>
      </ConfigProvider>
    );

    userEvent.click(screen.getByText(/Trigger/));
    expect(await screen.findByText(/Reflux: new custom dsn/)).toBeInTheDocument();
  });
});
