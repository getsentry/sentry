import * as React from 'react';
import styled from '@emotion/styled';

import Button, {ButtonProps} from 'sentry/components/button';
import space from 'sentry/styles/space';

const BaseButton: React.FC<ButtonProps> = props => {
  return <Button size="zero" {...props} />;
};

const ActionButton = styled(BaseButton)`
  padding: ${p => (p.icon ? space(0.75) : '7px')} ${space(1)};
  font-size: ${p => p.theme.fontSizeSmall};
`;

export default ActionButton;
