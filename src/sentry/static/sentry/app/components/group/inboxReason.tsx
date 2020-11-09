import React from 'react';
import styled from '@emotion/styled';

import {t} from 'app/locale';
import {IconSound, IconSync, IconWarning} from 'app/icons';
import space from 'app/styles/space';
import {Group} from 'app/types';
import Tooltip from 'app/components/tooltip';

const GroupInboxReason = {
  NEW: 0,
  UNIGNORED: 1,
  REGRESSION: 2,
  MANUAL: 3,
};

const renderReason = (reason?: number, reasonDetails?: string) => {
  const tooltip =
    reasonDetails || 'This issue was unignored.\n' + '100 events within 1 hour occurred';

  if (reason === GroupInboxReason.UNIGNORED) {
    return (
      <Tooltip title={tooltip}>
        <FlexWrapper>
          <StyledIconSound size="11px" color="purple300" />
          {t('Unignored')}
        </FlexWrapper>
      </Tooltip>
    );
  }

  if (reason === GroupInboxReason.REGRESSION) {
    return (
      <Tooltip title={tooltip}>
        <FlexWrapper>
          <StyledIconSync size="11px" color="purple300" />
          {t('Regression')}
        </FlexWrapper>
      </Tooltip>
    );
  }

  return (
    <Tooltip title={tooltip}>
      <FlexWrapper>
        <StyledIconWarning size="11px" color="purple300" />
        {t('New Issue')}
      </FlexWrapper>
    </Tooltip>
  );
};

type Props = {
  data: Group;
};

const InboxReason = ({data}: Props) => (
  <Container>{renderReason(data.inbox?.reason)}</Container>
);

const Container = styled('div')`
  display: flex;
  align-items: center;
  justify-content: center;
`;

const FlexWrapper = styled('div')`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2px 6px;

  background-color: ${p => p.theme.gray100};
  color: ${p => p.theme.gray600};
  font-size: ${p => p.theme.fontSizeExtraSmall};
  text-align: center;
  border-radius: 17px;
`;

const StyledIconWarning = styled(IconWarning)`
  margin-right: ${space(0.5)};
`;

const StyledIconSync = styled(IconSync)`
  margin-right: ${space(0.5)};
`;

const StyledIconSound = styled(IconSound)`
  margin-right: ${space(0.5)};
`;

export default InboxReason;
