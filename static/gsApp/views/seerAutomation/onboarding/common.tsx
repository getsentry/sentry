import styled from '@emotion/styled';

import Panel from 'sentry/components/panels/panel';
import PanelItem from 'sentry/components/panels/panelItem';

export const MaxWidthPanel = styled(Panel)`
  max-width: 600px;
`;

export const PanelDescription = styled('div')`
  padding: ${p => p.theme.space.xl};
  border-bottom: 1px solid ${p => p.theme.tokens.border.secondary};
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

export const Field = styled(PanelItem)`
  align-items: start;
  justify-content: space-between;
  gap: ${p => p.theme.space.xl};
`;

export const FieldLabel = styled('div')`
  font-weight: ${p => p.theme.fontWeight.bold};
`;

export const FieldDescription = styled('div')`
  font-size: ${p => p.theme.fontSize.sm};
  color: ${p => p.theme.subText};
  line-height: 1.4;
`;
