import styled from '@emotion/styled';

const Container = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${p => p.theme.space.md};
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  padding: ${p => p.theme.space.xl} ${p => p.theme.space['2xl']};
  margin-bottom: ${p => p.theme.space['2xl']};
`;

const Header = styled('h3')`
  font-size: ${p => p.theme.fontSize.xl};
  color: ${p => p.theme.gray300};
  margin-bottom: 0;
  line-height: 31px;
`;

// currently no styles are added but this is here for organization and future use
function Content(props: React.ComponentProps<'div'>) {
  return <div {...props} />;
}

export const OnboardingStep = {
  Container,
  Header,
  Content,
};
