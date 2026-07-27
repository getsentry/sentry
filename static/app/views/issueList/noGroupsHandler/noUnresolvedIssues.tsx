import zeroInboxIssuesImg from 'sentry-images/spot/zero-inbox-issues.svg';

import {Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

function Message({title, subtitle}: {subtitle: React.ReactNode; title: React.ReactNode}) {
  return (
    <Stack gap="xs">
      <Text bold size={{zero: 'md', sm: 'xl'}} align="center" variant="muted">
        {title}
      </Text>
      <Text as="p" size="md" align="center" variant="muted">
        {subtitle}
      </Text>
    </Stack>
  );
}

type Props = {
  subtitle: React.ReactNode;
  title: React.ReactNode;
};

export function NoUnresolvedIssues({title, subtitle}: Props) {
  return (
    <Stack align="center" padding="3xl">
      <img src={zeroInboxIssuesImg} alt="No issues found spot illustration" />
      <Message title={title} subtitle={subtitle} />
    </Stack>
  );
}
