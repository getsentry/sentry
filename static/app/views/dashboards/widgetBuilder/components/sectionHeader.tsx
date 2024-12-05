import styled from '@emotion/styled';

import {Tooltip} from 'sentry/components/tooltip';
import {space} from 'sentry/styles/space';

interface SectionHeaderProps {
  title: React.ReactNode;
  tooltipText?: React.ReactNode;
}

export function SectionHeader({tooltipText, title}: SectionHeaderProps) {
  return (
    <Tooltip
      title={tooltipText}
      disabled={!tooltipText}
      position="right-end"
      delay={200}
      isHoverable
      showUnderline
    >
      <StyledHeader>{title}</StyledHeader>
    </Tooltip>
  );
}

const StyledHeader = styled('h6')`
  font-size: ${p => p.theme.fontSizeLarge};
  margin-bottom: ${space(1)};
`;
