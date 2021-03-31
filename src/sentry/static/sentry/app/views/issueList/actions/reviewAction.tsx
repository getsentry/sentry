import React from 'react';

import ActionLink from 'app/components/actions/actionLink';
import {IconIssues} from 'app/icons';
import {t} from 'app/locale';

type Props = {
  onUpdate: (data?: any) => void;
  disabled?: boolean;
};

function ReviewAction({disabled, onUpdate}: Props) {
  return (
    <ActionLink
      type="button"
      priority="default"
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
