import {render} from 'sentry-test/reactTestingLibrary';

import type {Client} from 'sentry/api';
import withApi from 'sentry/utils/withApi';

describe('withApi', function () {
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

  it('renders MyComponent with an api prop', function () {
    const MyComponentWithApi = withApi(MyComponent);
    render(<MyComponentWithApi />);

    expect(MyComponent).toHaveBeenCalledWith(
      expect.objectContaining({api: apiInstance}),
      expect.anything()
    );
  });

  it('cancels pending API requests when component is unmounted', function () {
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
