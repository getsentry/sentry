import ActionLink from 'sentry/components/actions/actionLink';
import {TooltipProps} from 'sentry/components/tooltip';
import {IconIssues} from 'sentry/icons';
import {t} from 'sentry/locale';

type Props = {
  onUpdate: (data: {inbox: boolean}) => void;
  disabled?: boolean;
  tooltip?: string;
  tooltipProps?: Omit<TooltipProps, 'children' | 'title' | 'skipWrapper'>;
};

function ReviewAction({disabled, onUpdate, tooltipProps, tooltip}: Props) {
  return (
    <ActionLink
      type="button"
      disabled={disabled}
      onAction={() => onUpdate({inbox: false})}
      icon={<IconIssues size="xs" />}
      title={tooltip}
      tooltipProps={tooltipProps}
    >
      {t('Mark Reviewed')}
    </ActionLink>
  );
}

export default ReviewAction;
