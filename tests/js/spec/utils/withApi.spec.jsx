import {mount} from 'sentry-test/enzyme';

import withApi from 'app/utils/withApi';

describe('withApi', function () {
  let apiInstance;
  const MyComponent = jest.fn(props => {
    apiInstance = props.api;
    return <div />;
  });

  it('renders MyComponent with an api prop', function () {
    const MyComponentWithApi = withApi(MyComponent);
    mount(<MyComponentWithApi />);
    expect(MyComponent).toHaveBeenCalledWith(
      expect.objectContaining({
        api: expect.anything(),
      }),
      expect.anything()
    );
  });

  it('cancels pending API requests when component is unmounted', function () {
    const MyComponentWithApi = withApi(MyComponent);
    const wrapper = mount(<MyComponentWithApi />);
    jest.spyOn(apiInstance, 'clear');
    expect(apiInstance.clear).not.toHaveBeenCalled();
    wrapper.unmount();
    expect(apiInstance.clear).toHaveBeenCalled();

    apiInstance.clear.mockRestore();
  });

  it('does not cancels pending API requests if persistInFlight is enabled', function () {
    const MyComponentWithApi = withApi(MyComponent, {persistInFlight: true});
    const wrapper = mount(<MyComponentWithApi />);
    jest.spyOn(apiInstance, 'clear');
    wrapper.unmount();
    expect(apiInstance.clear).not.toHaveBeenCalled();

    apiInstance.clear.mockRestore();
  });
});
