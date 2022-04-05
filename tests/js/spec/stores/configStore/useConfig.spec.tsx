import {reactHooks} from 'sentry-test/reactTestingLibrary';

import {ConfigProvider} from 'sentry/stores/configStore/configProvider';
import {useConfig} from 'sentry/stores/configStore/useConfig';

describe('useConfig', () => {
  it('initializes with initialValue', () => {
    const initialValue = TestStubs.Config();
    const wrapper = ({children}) => {
      return <ConfigProvider initialValue={initialValue}>{children}</ConfigProvider>;
    };
    const {result} = reactHooks.renderHook(() => useConfig(), {wrapper});
    expect(result.current[0]).toEqual(initialValue);
  });
});
