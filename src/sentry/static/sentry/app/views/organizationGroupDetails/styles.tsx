import React from 'react';
import styled from '@emotion/styled';

import Label from 'app/components/label';
import {t} from 'app/locale';
import space from 'app/styles/space';

export const LabelAndMessageWrapper = styled('div')`
  display: flex;
  align-items: center;
`;

export const UnhandledLabel = styled(props => (
  <Label
    text={t('Unhandled')}
    tooltip={t('An unhandled error was detected in this Issue.')}
    type="error"
    {...props}
  />
))`
  margin-right: ${space(1)};
`;
