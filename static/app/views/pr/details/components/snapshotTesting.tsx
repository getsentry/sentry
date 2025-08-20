import styled from '@emotion/styled';

import {Heading} from 'sentry/components/core/text/heading';
import {Text} from 'sentry/components/core/text/text';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

interface SnapshotTestingProps {
  prId: string;
  repoName: string;
}

function SnapshotTesting({prId, repoName}: SnapshotTestingProps) {
  return (
    <Container>
      <HeaderSection>
        <Heading as="h2" size="lg">
          {t('Snapshot Testing')}
        </Heading>
        <Text variant="muted">
          {t('Visual regression testing results for PR #%s in %s', prId, repoName)}
        </Text>
      </HeaderSection>

      <ContentSection>TODO</ContentSection>
    </Container>
  );
}

const Container = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(3)};
`;

const HeaderSection = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(1)};
`;

const ContentSection = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(3)};
`;

export default SnapshotTesting;
