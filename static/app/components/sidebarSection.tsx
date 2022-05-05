import styled from '@emotion/styled';

import space from 'sentry/styles/space';

type Props = {
  title: React.ReactNode;
  children?: React.ReactNode;
  icon?: React.ReactNode;
};

/**
 * Used to add the new sidebar section on a page.
 */
function SidebarSection({title, children, icon, ...props}: Props) {
  return (
    <Wrapper>
      <Heading {...props}>
        {title}
        {icon && <IconWrapper>{icon}</IconWrapper>}
      </Heading>
      <SectionContent>{children}</SectionContent>
    </Wrapper>
  );
}

const Wrapper = styled('div')`
  margin-bottom: ${space(3)};
`;

const Heading = styled('h6')`
  color: ${p => p.theme.subText};
  display: flex;
  font-size: ${p => p.theme.fontSizeMedium};
  margin: ${space(1)} 0;
`;

const IconWrapper = styled('div')`
  color: ${p => p.theme.subText};
  margin-left: ${space(0.5)};
`;

const SectionContent = styled('div')`
  color: ${p => p.theme.subText};
`;

export default SidebarSection;
