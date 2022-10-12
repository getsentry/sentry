import styled from '@emotion/styled';

import {openModal} from 'sentry/actionCreators/modal';
import Button from 'sentry/components/button';
import Tooltip from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import type {Group, Organization} from 'sentry/types';

import ShareIssueModal from './shareModal';

interface ShareIssueProps {
  group: Group;
  onToggle: () => void;
  organization: Organization;
  disabled?: boolean;
  disabledReason?: string;
}

function ShareIssue({
  onToggle,
  disabled,
  group,
  organization,
  disabledReason,
}: ShareIssueProps) {
  const handleOpen = () => {
    // Starts sharing as soon as dropdown is opened
    openModal(modalProps => (
      <ShareIssueModal
        {...modalProps}
        organization={organization}
        projectSlug={group.project.slug}
        groupId={group.id}
        onToggle={onToggle}
      />
    ));
  };

  return (
    <Tooltip title={disabledReason} disabled={!disabled}>
      <Button
        type="button"
        size="xs"
        onClick={handleOpen}
        disabled={disabled}
        icon={
          <IndicatorDot
            aria-label={group.isPublic ? t('Shared') : t('Not Shared')}
            isShared={group.isPublic}
          />
        }
      >
        {t('Share')}
      </Button>
    </Tooltip>
  );
}

export default ShareIssue;

const IndicatorDot = styled('div')<{isShared?: boolean}>`
  border-radius: 50%;
  width: 10px;
  height: 10px;
  background: ${p => (p.isShared ? p.theme.active : p.theme.border)};
`;
