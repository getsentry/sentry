import React from 'react';
import styled from '@emotion/styled';
import classNames from 'classnames';

import ActionLink from 'app/components/actions/actionLink';
import {IconIssues} from 'app/icons';
import {t} from 'app/locale';
import space from 'app/styles/space';
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
    <div className="hidden-sm hidden-xs">
      <StyledActionLink
        className={classNames('btn btn-sm action-merge', {
          'btn-primary': primary,
          'btn-default': !primary,
        })}
        data-test-id="button-acknowledge"
        disabled={disabled}
        onAction={() => onUpdate({inbox: false})}
        shouldConfirm={onShouldConfirm?.(ConfirmAction.ACKNOWLEDGE)}
        message={confirm?.('mark', false, ' as reviewed')}
        confirmLabel={label?.('Mark', ' as reviewed')}
        title={t('Mark Reviewed')}
      >
        <StyledIconIssues size="xs" />
        {t('Mark Reviewed')}
      </StyledActionLink>
    </div>
  );
}

export default ReviewAction;

const StyledActionLink = styled(ActionLink)`
  display: flex;
  align-items: center;
  transition: none;
`;

const StyledIconIssues = styled(IconIssues)`
  margin-right: ${space(0.5)};
`;
