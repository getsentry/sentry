import ActionLink from 'sentry/components/actions/actionLink';
import {IssueActionWrapper} from 'sentry/components/actions/issueActionWrapper';
import type {TooltipProps} from 'sentry/components/tooltip';
import {IconIssues} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {IssueUpdateData} from 'sentry/views/issueList/types';

type Props = {
  onUpdate: (data: IssueUpdateData) => void;
  disabled?: boolean;
  tooltip?: string;
  tooltipProps?: Omit<TooltipProps, 'children' | 'title' | 'skipWrapper'>;
};

function ReviewAction({disabled, onUpdate, tooltipProps, tooltip}: Props) {
  return (
    <IssueActionWrapper>
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
    </IssueActionWrapper>
  );
}

export default ReviewAction;
