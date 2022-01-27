import ActionLink from 'sentry/components/actions/actionLink';
import {IconIssues} from 'sentry/icons';
import {t} from 'sentry/locale';

type Props = {
  onUpdate: (data?: any) => void;
  disabled?: boolean;
};

function ReviewAction({disabled, onUpdate}: Props) {
  return (
    <ActionLink
      type="button"
      disabled={disabled}
      onAction={() => onUpdate({inbox: false})}
      title={t('Mark Reviewed')}
      icon={<IconIssues size="xs" />}
    >
      {t('Mark Reviewed')}
    </ActionLink>
  );
}

export default ReviewAction;
