import Confirm from 'sentry/components/confirm';
import {t} from 'sentry/locale';

type Props = React.ComponentProps<typeof Confirm>;

function RemoveConfirm(props: Props) {
  return (
    <Confirm
      {...props}
      header={t('Do you want to remove this method?')}
      message={t(
        'Removing the last authentication method will disable two-factor authentication completely.'
      )}
    />
  );
}

export default RemoveConfirm;
