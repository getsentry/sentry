import styled from '@emotion/styled';

import Tooltip from 'app/components/tooltip';
import {IconInfo} from 'app/icons/iconInfo';
import {t} from 'app/locale';

type Props = {
  className?: string;
};

function GroupingIndicator({className}: Props) {
  return (
    <StyledTooltip
      title={t('This frame appears in all other events related to this issue')}
      containerDisplayMode="inline-flex"
      className={className}
    >
      <IconInfo size="xs" color="gray300" />
    </StyledTooltip>
  );
}

export default GroupingIndicator;

const StyledTooltip = styled(Tooltip)`
  align-items: center;
`;
