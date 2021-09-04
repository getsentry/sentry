import * as React from 'react';
import styled from '@emotion/styled';

import space from 'app/styles/space';

const Subheading = styled('h6')`
  color: ${p => p.theme.gray300};
  display: flex;
  font-size: ${p => p.theme.fontSizeMedium};
  margin-bottom: ${space(1)};
`;

type Props = {
  title: React.ReactNode;
  children?: React.ReactNode;
  icon?: React.ReactNode;
};

/**
 * Used to add a new subheading in a sidebar section.
 */
function SidebarSectionTitle({title, children, icon, ...props}: Props) {
  const HeaderComponent = Subheading;

  return (
    <React.Fragment>
      <HeaderComponent {...props}>
        {title}
        {icon && <IconWrapper>{icon}</IconWrapper>}
      </HeaderComponent>
      <SectionContent>{children}</SectionContent>
    </React.Fragment>
  );
}

const IconWrapper = styled('div')`
  color: ${p => p.theme.gray200};
  margin-left: ${space(0.5)};
`;

const SectionContent = styled('div')`
  margin-bottom: ${space(3)};
`;

export default SidebarSectionTitle;
