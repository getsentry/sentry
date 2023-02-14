import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';

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
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  display: flex;
  margin-bottom: ${space(3)};
  flex-direction: column;

  @media (min-width: ${p => p.theme.breakpoints.medium}) {
    flex-direction: row;
  }
`;

const LeftPanel = styled('div')`
  padding: ${space(2)} ${space(2)};
  border-bottom: 1px solid ${p => p.theme.border};

  @media (min-width: ${p => p.theme.breakpoints.medium}) {
    max-width: 250px;
    border-right: 1px solid ${p => p.theme.border};
    border-bottom: 0;
  }
`;

const Title = styled('div')`
  font-size: ${p => p.theme.fontSizeLarge};
  margin: 0 0 ${space(0.5)};
`;

const Description = styled('div')`
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizeMedium};
`;

const RightPanel = styled('div')`
  flex-grow: 1;
`;
