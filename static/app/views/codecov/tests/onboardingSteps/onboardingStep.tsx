import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';

const Container = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(1)};
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  padding: ${space(2)} ${space(3)};
  margin-bottom: ${space(3)};
`;

const Header = styled('h3')`
  font-size: ${p => p.theme.fontSizeExtraLarge};
  color: ${p => p.theme.gray300};
  margin-bottom: 0;
  line-height: 31px;
`;

// currently no styles are added but this is here for organization and future use
function Content(props: any) {
  return <div {...props} />;
}

export const OnboardingStep = {
  Container,
  Header,
  Content,
};
