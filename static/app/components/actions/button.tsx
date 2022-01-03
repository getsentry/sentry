import * as React from 'react';
import styled from '@emotion/styled';

import Button from 'sentry/components/button';
import space from 'sentry/styles/space';

const BaseButton = (props: React.ComponentProps<typeof Button>) => (
  <Button size="zero" {...props} />
);

const ActionButton = styled(BaseButton)`
  padding: ${space(0.75)} ${space(1)};
  font-size: ${p => p.theme.fontSizeSmall};
`;

export default ActionButton;
