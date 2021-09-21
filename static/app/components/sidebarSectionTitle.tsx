import * as React from 'react';
import styled from '@emotion/styled';

import space from 'app/styles/space';

type Props = {
  title: React.ReactNode;
  icon?: React.ReactNode;
};

/**
 * Used to add a new subheading in a sidebar section.
 */
function SidebarSectionTitle({title, icon, ...props}: Props) {
  return (
    <Heading {...props}>
      {title}
      {icon && <IconWrapper>{icon}</IconWrapper>}
    </Heading>
  );
}

const Heading = styled('h6')`
  color: ${p => p.theme.gray400};
  display: flex;
  font-size: ${p => p.theme.fontSizeMedium};
  margin-bottom: ${space(1)};
`;

const IconWrapper = styled('div')`
  color: ${p => p.theme.gray200};
  margin-left: ${space(0.5)};
`;

export default SidebarSectionTitle;
