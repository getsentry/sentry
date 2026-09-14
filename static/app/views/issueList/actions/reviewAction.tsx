import {ActionLink} from 'sentry/components/actions/actionLink';
import {IconIssues} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {IssueUpdateData} from 'sentry/views/issueList/types';

type Props = {
  onUpdate: (data: IssueUpdateData) => void;
  disabled?: boolean;
};

export function ReviewAction({disabled, onUpdate}: Props) {
  return (
    <ActionLink
      type="button"
      disabled={disabled}
      onAction={() => onUpdate({inbox: false})}
      icon={<IconIssues size="xs" />}
    >
      {t('Mark Reviewed')}
    </ActionLink>
  );
}
