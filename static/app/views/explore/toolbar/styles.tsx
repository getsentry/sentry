import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';

export const ToolbarSection = styled('div')`
  margin-bottom: ${space(2)};
`;

export const ToolbarHeading = styled('h6')<{disabled?: boolean}>`
  color: ${p => (p.disabled ? p.theme.gray300 : p.theme.purple300)};
  height: ${p => p.theme.form.md.height};
  min-height: ${p => p.theme.form.md.minHeight};
  font-size: ${p => p.theme.form.md.fontSize};
  line-height: ${p => p.theme.form.md.lineHeight};
  text-decoration: underline dotted
    ${p => (p.disabled ? p.theme.gray300 : p.theme.purple300)};
  margin: 0 0 ${space(1)} 0;
`;
