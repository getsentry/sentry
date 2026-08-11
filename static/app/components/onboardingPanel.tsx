import {EmptyState} from '@sentry/scraps/emptyState';
import {Container} from '@sentry/scraps/layout';

import {Panel} from 'sentry/components/panels/panel';

type Props = Omit<React.ComponentProps<typeof Panel>, 'children' | 'title'> &
  Pick<
    React.ComponentProps<typeof EmptyState>,
    'title' | 'action' | 'description' | 'illustration'
  >;

export function OnboardingPanel({
  title,
  description,
  action,
  illustration,
  ...panelProps
}: Props) {
  return (
    <Container width="100%" flexGrow={1} minWidth={0}>
      <Panel {...panelProps}>
        <EmptyState
          padding="3xl"
          align="center"
          justify="center"
          title={title}
          description={description}
          action={action}
          illustration={illustration}
        />
      </Panel>
    </Container>
  );
}
