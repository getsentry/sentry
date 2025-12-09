import styled from '@emotion/styled';

import Panel from 'sentry/components/panels/panel';

export const MaxWidthPanel = styled(Panel)`
  max-width: 600px;
`;

export const PanelDescription = styled('div')`
  padding: ${p => p.theme.space.xl};
  border-bottom: 1px solid ${p => p.theme.innerBorder};
`;

export const StepContent = styled('div')`
  margin-top: ${p => p.theme.space.lg};
  margin-bottom: ${p => p.theme.space.xl};

  p {
    margin-bottom: ${p => p.theme.space.lg};
    line-height: 1.6;
  }

  p:last-of-type {
    margin-bottom: 0;
  }
`;

export const ActionSection = styled('div')`
  margin-top: ${p => p.theme.space.xl};
  display: flex;
  gap: ${p => p.theme.space.md};
`;
