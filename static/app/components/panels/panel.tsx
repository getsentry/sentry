import styled from '@emotion/styled';

import space from 'sentry/styles/space';

type Props = {
  dashedBorder?: boolean;
  'data-test-id'?: string;
};

const Panel = styled('div')<Props>`
  background: ${p => (p.dashedBorder ? p.theme.backgroundSecondary : p.theme.background)};
  border-radius: ${p => p.theme.borderRadius};
  border: 1px
    ${p => (p.dashedBorder ? 'dashed' + p.theme.gray300 : 'solid ' + p.theme.border)};
  box-shadow: ${p => (p.dashedBorder ? 'none' : p.theme.dropShadowLight)};
  margin-bottom: ${space(2)};
  position: relative;
`;

export default Panel;
