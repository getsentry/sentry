import styled from '@emotion/styled';

import {IconSeer} from 'sentry/icons';
import {space} from 'sentry/styles/space';

function EmptyState() {
  return (
    <Container>
      <IconSeer size="xl" variant="waiting" />
      <Text>
        Welcome to Seer Explorer.
        <br />
        Ask me anything about your application.
      </Text>
    </Container>
  );
}

export default EmptyState;

const Container = styled('div')`
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: ${space(4)};
  text-align: center;
`;

const Text = styled('div')`
  margin-top: ${space(2)};
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSize.md};
  line-height: 1.4;
  max-width: 300px;
`;
