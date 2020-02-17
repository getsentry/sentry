import React from 'react';
import styled from '@emotion/styled';

import Tag from 'app/views/settings/components/tag';
import Tooltip from 'app/components/tooltip';
import space from 'app/styles/space';
import {t} from 'app/locale';

type Props = {
  title?: string;
};

const BetaTag = ({
  title = t('This feature is in beta and may change in the future.'),
}: Props) => (
  <Tooltip title={title} position="right">
    <StyledTag priority="beta" size="small">
      {t('beta')}
    </StyledTag>
  </Tooltip>
);

const StyledTag = styled(Tag)`
  position: relative;
  top: -1px;
  font-size: ${p => p.theme.fontSizeSmall};
  font-weight: normal;
  padding: 3px ${space(0.75)};
  margin-left: ${space(0.5)};
  border-radius: 20px;
`;

export default BetaTag;
