import {mountWithTheme} from 'sentry-test/reactTestingLibrary';

import {Client} from 'app/api';
import useApi from 'app/utils/useApi';

describe('useApi', function () {
  let apiInstance: Client;

  type Props = {
    /**
     * Test passthrough API clients
     */
    api?: Client;
    /**
     * Test persistInFlight
     */
    persistInFlight?: boolean;
  };

  const MyComponent: React.FC<Props> = ({api, persistInFlight}) => {
    apiInstance = useApi({api, persistInFlight});
    return <div />;
  };

  it('renders MyComponent with an api prop', function () {
    mountWithTheme(<MyComponent />);

    expect(apiInstance).toBeInstanceOf(Client);
  });

  it('cancels pending API requests when component is unmounted', function () {
    const {unmount} = mountWithTheme(<MyComponent />);

    jest.spyOn(apiInstance, 'clear');
    unmount();

    expect(apiInstance.clear).toHaveBeenCalled();
  });

  it('does not cancel inflights when persistInFlight is true', function () {
    const {unmount} = mountWithTheme(<MyComponent persistInFlight />);

    jest.spyOn(apiInstance, 'clear');
    unmount();

    expect(apiInstance.clear).not.toHaveBeenCalled();
  });

  it('uses pass through API when provided', function () {
    const myClient = new Client();
    const {unmount} = mountWithTheme(<MyComponent api={myClient} />);

    jest.spyOn(myClient, 'clear');
    unmount();

    expect(myClient.clear).toHaveBeenCalled();
  });
});
