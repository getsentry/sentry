import React from 'react';
import styled from 'react-emotion';
import Tag from 'app/views/settings/components/tag';
import Tooltip from 'app/components/tooltip';
import space from 'app/styles/space';
import {t} from 'app/locale';

const BetaTag = () => (
  <Tooltip
    title={t('This feature is in beta and may change in the future.')}
    tooltipOptions={{
      placement: 'right',
    }}
  >
    <span>
      <StyledTag priority="beta" size="small">
        beta
      </StyledTag>
    </span>
  </Tooltip>
);

const StyledTag = styled(Tag)`
  position: relative;
  top: -1px;
  font-size: ${p => p.theme.fontSizeSmall};
  font-weight: normal;
  padding: 3px 6px;
  margin-left: ${space(0.5)};
  border-radius: 20px;
`;

export default BetaTag;
