import {forwardRef} from 'react';
import isPropValid from '@emotion/is-prop-valid';
import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';
import PanelProvider from 'sentry/utils/panelProvider';

interface PanelProps extends React.HTMLAttributes<HTMLDivElement> {
  dashedBorder?: boolean;
  'data-test-id'?: string;
}

const Panel = styled(
  forwardRef<HTMLDivElement, PanelProps>(({children, ...props}, forwardedRef) => (
    <div ref={forwardedRef} {...props}>
      <PanelProvider>{children}</PanelProvider>
    </div>
  )),
  {shouldForwardProp: prop => typeof prop === 'string' && isPropValid(prop)}
)`
  background: ${p => (p.dashedBorder ? p.theme.backgroundSecondary : p.theme.background)};
  border-radius: ${p => p.theme.borderRadius};
  border: 1px
    ${p => (p.dashedBorder ? 'dashed' + p.theme.gray300 : 'solid ' + p.theme.border)};
  margin-bottom: ${space(2)};
  position: relative;
`;

export default Panel;
