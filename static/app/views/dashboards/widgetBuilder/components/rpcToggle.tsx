import {Flex} from 'sentry/components/container/flex';
import SwitchButton from 'sentry/components/switchButton';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import {useQueryParamState} from 'sentry/views/dashboards/widgetBuilder/hooks/useQueryParamState';

export const DASHBOARD_RPC_TOGGLE_KEY = 'dashboards-spans-use-rpc';

function RPCToggle() {
  const [_, setIsRpcEnabled] = useQueryParamState<boolean>({
    fieldName: 'useRpc',
  });
  // This is hacky, but we need to access the RPC toggle state in the spans dataset config
  // and I don't want to pass it down as a prop when it's only temporary.
  const [isRpcEnabled, setRpcLocalStorage] = useLocalStorageState(
    DASHBOARD_RPC_TOGGLE_KEY,
    false
  );

  return (
    <Flex gap={space(1)}>
      <SwitchButton
        isActive={isRpcEnabled}
        toggle={() => {
          const newValue = !isRpcEnabled;
          setIsRpcEnabled(newValue);
          setRpcLocalStorage(newValue);
        }}
      />
      <div>{t('Use RPC')}</div>
    </Flex>
  );
}

export default RPCToggle;
