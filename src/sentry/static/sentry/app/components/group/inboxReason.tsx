import React from 'react';
import moment from 'moment';
import styled from '@emotion/styled';

import {t} from 'app/locale';
import {IconSound, IconSwitch, IconSync, IconWarning} from 'app/icons';
import {Group} from 'app/types';
import Tag from 'app/components/tag';
import DateTime from 'app/components/dateTime';

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
  const {reason, reason_details, date_added: dateAdded} = data.inbox || {};

  let reasonIcon: React.ReactNode;
  let reasonBadgeText: string;
  let tooltipText: string | undefined;

  if (reason === GroupInboxReason.UNIGNORED) {
    reasonIcon = <IconSound />;
    reasonBadgeText = t('Unignored');
    tooltipText = t('%(count)s events within %(window)s', {
      count: reason_details?.count || 0,
      window: moment.duration(reason_details?.window || 0, 'minutes').humanize(),
    });
  } else if (reason === GroupInboxReason.REGRESSION) {
    reasonIcon = <IconSync />;
    reasonBadgeText = t('Regression');
    tooltipText = t('Issue was previously resolved.');
  } else if (reason === GroupInboxReason.MANUAL) {
    reasonIcon = <IconSwitch />;
    reasonBadgeText = t('Manual');
    // TODO(scttcper): Add tooltip text for a manual move
    // Moved to inbox by {full_name}.
  } else {
    reasonIcon = <IconWarning />;
    reasonBadgeText = t('New Issue');
  }

  const tooltip = (
    <React.Fragment>
      {tooltipText && <div>{tooltipText}</div>}
      {dateAdded && (
        <DateWrapper>
          <DateTime date={dateAdded} />
        </DateWrapper>
      )}
    </React.Fragment>
  );

  return (
    <Tag icon={reasonIcon} tooltipText={tooltip}>
      {reasonBadgeText}
    </Tag>
  );
};

export default InboxReason;

const DateWrapper = styled('div')`
  color: ${p => p.theme.gray200};
`;
