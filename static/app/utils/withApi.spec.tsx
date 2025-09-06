import {render} from 'sentry-test/reactTestingLibrary';

import type {Client} from 'sentry/api';
import withApi from 'sentry/utils/withApi';

describe('withApi', () => {
  let apiInstance: Client | undefined;

  type Props = {
    /**
     * Test passthrough API clients
     */
    api?: Client;
  };

  const MyComponent = jest.fn((props: Props) => {
    apiInstance = props.api;
    return <div />;
  });

  it('renders MyComponent with an api prop', () => {
    const MyComponentWithApi = withApi(MyComponent);
    render(<MyComponentWithApi />);

    expect(MyComponent.mock.calls[0]![0]).toEqual(
      expect.objectContaining({api: apiInstance})
    );
  });

  it('cancels pending API requests when component is unmounted', () => {
    const MyComponentWithApi = withApi(MyComponent);
    const wrapper = render(<MyComponentWithApi />);

    if (apiInstance === undefined) {
      throw new Error("apiInstance wasn't defined");
    }

    jest.spyOn(apiInstance, 'clear');

    expect(apiInstance?.clear).not.toHaveBeenCalled();
    wrapper.unmount();

    expect(apiInstance?.clear).toHaveBeenCalled();
  });
});
