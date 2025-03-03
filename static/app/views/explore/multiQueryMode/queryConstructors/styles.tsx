import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';
import {defined} from 'sentry/utils';

export const Section = styled('div')``;

export const SectionHeader = styled('div')`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: ${space(0.5)};
`;

export const SectionLabel = styled('h6')<{disabled?: boolean; underlined?: boolean}>`
  color: ${p => (p.disabled ? p.theme.gray300 : p.theme.gray500)};
  height: ${p => p.theme.form.md.height};
  min-height: ${p => p.theme.form.md.minHeight};
  font-size: ${p => p.theme.form.md.fontSize};
  margin: 0;
  ${p =>
    !defined(p.underlined) || p.underlined
      ? `text-decoration: underline dotted ${p.disabled ? p.theme.gray300 : p.theme.gray300}`
      : ''};
`;
