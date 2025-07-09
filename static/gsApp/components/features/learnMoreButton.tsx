import {LinkButton} from 'sentry/components/core/button/linkButton';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';

import trackGetsentryAnalytics from 'getsentry/utils/trackGetsentryAnalytics';

const learnMoreClicked = ({
  source,
  organization,
}: Pick<Props, 'source' | 'organization'>) =>
  trackGetsentryAnalytics('learn_more_link.clicked', {
    organization,
    source,
  });

type Props = React.PropsWithChildren<{
  organization: Organization;
  source: string;
  analyticsData?: Record<string, any>;
  'aria-label'?: string;
  children?: React.ReactNode;
}> &
  React.ComponentProps<typeof LinkButton>;

function LearnMoreButton({organization, source, children, ...props}: Props) {
  return (
    <LinkButton onClick={() redesign => learnMoreClicked({source, organization})} {...props}>
      {children || t('Learn More')}
    </LinkButton>
  );
}

export default LearnMoreButton;
