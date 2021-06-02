import * as React from 'react';
import styled from '@emotion/styled';

import space from 'app/styles/space';

const Heading = styled('h5')`
  display: flex;
  align-items: center;
  margin-bottom: ${space(2)};
  font-size: ${p => p.theme.fontSizeMedium};

  &:after {
    flex: 1;
    display: block;
    content: '';
    border-top: 1px solid ${p => p.theme.innerBorder};
    margin-left: ${space(1)};
  }
`;

const Subheading = styled('h6')`
  color: ${p => p.theme.gray300};
  display: flex;
  font-size: ${p => p.theme.fontSizeExtraSmall};
  text-transform: uppercase;
  justify-content: space-between;
  margin-bottom: ${space(1)};
`;

type Props = {
  title: React.ReactNode;
  children: React.ReactNode;
  secondary?: boolean;
} & Omit<React.ComponentProps<typeof Heading>, 'title'>;

/**
 * Used to add a new section in Issue Details' sidebar.
 */
function SidebarSection({title, children, secondary, ...props}: Props) {
  const HeaderComponent = secondary ? Subheading : Heading;

  return (
    <React.Fragment>
      <HeaderComponent {...props}>{title}</HeaderComponent>
      <SectionContent secondary={secondary}>{children}</SectionContent>
    </React.Fragment>
  );
}

const SectionContent = styled('div')<{secondary?: boolean}>`
  margin-bottom: ${p => (p.secondary ? space(2) : space(3))};
`;

export default SidebarSection;
