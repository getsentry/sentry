import isPropValid from '@emotion/is-prop-valid';
import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';
import PanelProvider from 'sentry/utils/panelProvider';

interface PanelProps extends React.HTMLAttributes<HTMLDivElement> {
  dashedBorder?: boolean;
  'data-test-id'?: string;
  hideBorder?: boolean;
  ref?: React.Ref<HTMLDivElement>;
}

const Panel = styled(
  ({children, ...props}: PanelProps) => (
    <div {...props}>
      <PanelProvider>{children}</PanelProvider>
    </div>
  ),
  {shouldForwardProp: prop => typeof prop === 'string' && isPropValid(prop)}
)`
  background: ${p =>
    p.dashedBorder ? p.theme.backgroundSecondary : p.theme.tokens.background.primary};
  border-radius: ${p => p.theme.radius.md};
  border: 1px
    ${p =>
      p.hideBorder
        ? 'transparent'
        : p.dashedBorder
          ? 'dashed' + p.theme.colors.gray400
          : 'solid ' + p.theme.tokens.border.primary};
  margin-bottom: ${space(2)};
  position: relative;
`;

export default Panel;
