import React from 'react';

import ActionLink from 'app/components/actions/actionLink';
import {IconIssues} from 'app/icons';
import {t} from 'app/locale';
import {Organization} from 'app/types';

import {ConfirmAction, getConfirm, getLabel} from './utils';

type Props = {
  orgSlug: Organization['slug'];
  onUpdate: (data?: any) => void;
  primary?: boolean;
  disabled?: boolean;
  confirm?: ReturnType<typeof getConfirm>;
  label?: ReturnType<typeof getLabel>;
  onShouldConfirm?: (action: ConfirmAction) => boolean;
};

function ReviewAction({
  disabled,
  primary,
  onShouldConfirm,
  onUpdate,
  confirm,
  label,
}: Props) {
  return (
    <ActionLink
      type="button"
      priority={primary ? 'primary' : 'default'}
      disabled={disabled}
      onAction={() => onUpdate({inbox: false})}
      shouldConfirm={onShouldConfirm?.(ConfirmAction.ACKNOWLEDGE)}
      message={confirm?.('mark', false, ' as reviewed')}
      confirmLabel={label?.('Mark', ' as reviewed')}
      title={t('Mark Reviewed')}
      icon={<IconIssues size="xs" />}
    >
      {t('Mark Reviewed')}
    </ActionLink>
  );
}

export default ReviewAction;
