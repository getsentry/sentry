import React from 'react';

import {t} from 'app/locale';
import {IconSound, IconSwitch, IconSync, IconWarning} from 'app/icons';
import {Group} from 'app/types';
import Tag from 'app/components/tag';

const GroupInboxReason = {
  NEW: 0,
  UNIGNORED: 1,
  REGRESSION: 2,
  MANUAL: 3,
};

type Props = {
  data: Group;
};

const InboxReason = ({data}: Props) => {
  const {reason} = data.inbox || {};

  let reasonIcon: React.ReactNode;
  let reasonBadgeText: string;
  let tooltipText: string;

  if (reason === GroupInboxReason.UNIGNORED) {
    reasonIcon = <IconSound color="purple300" />;
    reasonBadgeText = t('Unignored');
    tooltipText = 'This issue was unignored';
  } else if (reason === GroupInboxReason.REGRESSION) {
    reasonIcon = <IconSync color="purple300" />;
    reasonBadgeText = t('Regression');
    tooltipText = 'This issue was a regression';
  } else if (reason === GroupInboxReason.MANUAL) {
    reasonIcon = <IconSwitch color="purple300" />;
    reasonBadgeText = t('Manual');
    tooltipText = 'This issue was moved manually';
  } else {
    reasonIcon = <IconWarning color="purple300" />;
    reasonBadgeText = t('New Issue');
    tooltipText = 'This is a new issue';
  }

  return (
    <Tag icon={reasonIcon} tooltipText={tooltipText}>
      {reasonBadgeText}
    </Tag>
  );
};

export default InboxReason;
