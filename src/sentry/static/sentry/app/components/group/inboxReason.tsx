import React from 'react';
import styled from '@emotion/styled';
import moment from 'moment';

import {t} from 'app/locale';
import {IconSound, IconSwitch, IconSync, IconWarning} from 'app/icons';
import space from 'app/styles/space';
import {Group} from 'app/types';
import Tooltip from 'app/components/tooltip';

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
  const {reason, reason_details} = data.inbox || {};

  let reasonIcon: React.ReactNode;
  let reasonBadgeText: string;
  let tooltipText: string;

  const tooltipWindowCount = t('%(count)s events within %(window)s occured', {
    count: reason_details?.count || 0,
    window: moment.duration(reason_details?.window || 0, 'minutes').humanize(),
  });

  if (reason === GroupInboxReason.UNIGNORED) {
    reasonIcon = <IconSound size="11px" color="purple300" />;
    reasonBadgeText = t('Unignored');
    tooltipText = 'This issue was unignored';
  } else if (reason === GroupInboxReason.REGRESSION) {
    reasonIcon = <IconSync size="11px" color="purple300" />;
    reasonBadgeText = t('Regression');
    tooltipText = 'This issue was a regression';
  } else if (reason === GroupInboxReason.MANUAL) {
    reasonIcon = <IconSwitch size="11px" color="purple300" />;
    reasonBadgeText = t('Manual');
    tooltipText = 'This issue was moved manually';
  } else {
    reasonIcon = <IconWarning size="11px" color="purple300" />;
    reasonBadgeText = t('New Issue');
    tooltipText = 'This is a new issue';
  }

  return (
    <Container>
      <Tooltip
        title={
          <TooltipTitle>
            {tooltipText}
            <br />
            {tooltipWindowCount}
          </TooltipTitle>
        }
      >
        <Wrapper>
          {reasonIcon}
          <div>{reasonBadgeText}</div>
        </Wrapper>
      </Tooltip>
    </Container>
  );
};

const Container = styled('div')`
  display: flex;
  align-items: center;
  justify-content: center;
`;

const Wrapper = styled('div')`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: ${space(0.25)} ${space(0.75)};

  background-color: ${p => p.theme.gray100};
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizeExtraSmall};
  text-align: center;
  border-radius: 17px;

  > * :not(:last-child) {
    margin-right: ${space(0.5)};
  }
`;

const TooltipTitle = styled('div')`
  text-align: left;

  > * :last-child {
    font-weight: 400;
  }
`;

export default InboxReason;
