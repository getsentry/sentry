import {Fragment} from 'react';
import styled from '@emotion/styled';

import space from 'sentry/styles/space';

const Heading = styled('h5')`
  display: flex;
  align-items: center;
  margin-bottom: ${space(2)};
  font-size: ${p => p.theme.fontSizeMedium};
  line-height: 1;

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
  align-items: center;
  font-size: ${p => p.theme.fontSizeExtraSmall};
  text-transform: uppercase;
  margin-bottom: ${space(1)};
  line-height: 1;
`;

interface SidebarSectionProps
  extends Omit<React.HTMLAttributes<HTMLHeadingElement>, 'title'> {
  children: React.ReactNode;
  title: React.ReactNode;
  secondary?: boolean;
}

/**
 * Used to add a new section in Issue Details' sidebar.
 */
function SidebarSection({title, children, secondary, ...props}: SidebarSectionProps) {
  const HeaderComponent = secondary ? Subheading : Heading;

  return (
    <Fragment>
      <HeaderComponent {...props}>{title}</HeaderComponent>
      <SectionContent>{children}</SectionContent>
    </Fragment>
  );
}

const SectionContent = styled('div')`
  margin-bottom: ${space(4)};
  line-height: 1;
`;

export default SidebarSection;
