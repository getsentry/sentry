import * as React from 'react';
import styled from '@emotion/styled';

import Button from 'app/components/button';
import space from 'app/styles/space';

const BaseButton = (props: React.ComponentProps<typeof Button>) => (
  <Button size="zero" {...props} />
);

const ActionButton = styled(BaseButton)`
  padding: ${p => (p.icon ? space(0.75) : '7px')} ${space(1)};
  font-size: ${p => p.theme.fontSizeSmall};
`;

export default ActionButton;
