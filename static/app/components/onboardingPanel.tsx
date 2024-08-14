import styled from '@emotion/styled';

import Panel from 'sentry/components/panels/panel';
import {space} from 'sentry/styles/space';

interface Props extends React.ComponentProps<typeof Panel> {
  children: React.ReactNode;
  image?: React.ReactNode;
  noCenter?: boolean;
}

function OnboardingPanel({image, noCenter, children, ...props}: Props) {
  return (
    <Panel {...props}>
      <Container>
        {image ? <IlloBox>{image}</IlloBox> : null}
        <StyledBox centered={!image && !noCenter}>{children}</StyledBox>
      </Container>
    </Panel>
  );
}

const Container = styled('div')`
  padding: ${space(3)};
  position: relative;

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    display: flex;
    align-items: center;
    flex-direction: row;
    justify-content: center;
    flex-wrap: wrap;
    min-height: 300px;
    max-width: 1000px;
    margin: 0 auto;
  }

  @media (min-width: ${p => p.theme.breakpoints.medium}) {
    min-height: 350px;
  }
`;

const StyledBox = styled('div')<{centered?: boolean}>`
  min-width: 0;
  z-index: 1;

  ${p => (p.centered ? 'text-align: center;' : '')}
  ${p => (p.centered ? 'max-width: 600px;' : '')}

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    flex: 2;
  }
`;

const IlloBox = styled(StyledBox)`
  position: relative;
  min-height: 100px;
  max-width: 300px;
  min-width: 150px;
  margin: ${space(2)} auto;

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    flex: 1;
    margin: ${space(3)};
    max-width: auto;
  }
`;

export default OnboardingPanel;
