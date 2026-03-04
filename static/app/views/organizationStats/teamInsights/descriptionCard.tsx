import styled from '@emotion/styled';

type Props = {
  children: React.ReactNode;
  description: React.ReactNode;
  title: string;
};

function DescriptionCard({title, description, children}: Props) {
  return (
    <Wrapper>
      <LeftPanel>
        <Title>{title}</Title>
        <Description>{description}</Description>
      </LeftPanel>
      <RightPanel>{children}</RightPanel>
    </Wrapper>
  );
}

export default DescriptionCard;

const Wrapper = styled('div')`
  border: 1px solid ${p => p.theme.tokens.border.primary};
  border-radius: ${p => p.theme.radius.md};
  display: flex;
  margin-bottom: ${p => p.theme.space['2xl']};
  flex-direction: column;

  @media (min-width: ${p => p.theme.breakpoints.md}) {
    flex-direction: row;
  }
`;

const LeftPanel = styled('div')`
  padding: ${p => p.theme.space.xl} ${p => p.theme.space.xl};
  border-bottom: 1px solid ${p => p.theme.tokens.border.primary};

  @media (min-width: ${p => p.theme.breakpoints.md}) {
    max-width: 250px;
    border-right: 1px solid ${p => p.theme.tokens.border.primary};
    border-bottom: 0;
  }
`;

const Title = styled('div')`
  font-size: ${p => p.theme.font.size.lg};
  margin: 0 0 ${p => p.theme.space.xs};
`;

const Description = styled('div')`
  color: ${p => p.theme.tokens.content.secondary};
  font-size: ${p => p.theme.font.size.md};
`;

const RightPanel = styled('div')`
  flex-grow: 1;
`;
