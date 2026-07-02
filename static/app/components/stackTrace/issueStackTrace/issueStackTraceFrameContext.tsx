import {useMemo} from 'react';

import {useSourceContext} from 'sentry/components/events/interfaces/frame/useSourceContext';
import {
  hasContextSource,
  hasPotentialSourceContext,
} from 'sentry/components/events/interfaces/frame/utils';
import {FrameContent} from 'sentry/components/stackTrace/frame/frameContent';
import {
  useStackTraceContext,
  useStackTraceFrameContext,
} from 'sentry/components/stackTrace/stackTraceContext';
import {defined} from 'sentry/utils/defined';
import {useOrganization} from 'sentry/utils/useOrganization';

export function IssueStackTraceFrameContext() {
  const {event, frame, isExpanded} = useStackTraceFrameContext();
  const {hasScmSourceContext, project} = useStackTraceContext();
  const organization = useOrganization();

  const hasEmbeddedContext = hasContextSource(frame);
  const shouldFetchSourceContext =
    hasScmSourceContext &&
    defined(project) &&
    !hasEmbeddedContext &&
    isExpanded &&
    hasPotentialSourceContext(frame);

  const {data: sourceContextData, isPending: isLoadingSourceContext} = useSourceContext(
    {
      event,
      frame,
      orgSlug: organization.slug,
      projectSlug: project?.slug,
    },
    {enabled: shouldFetchSourceContext}
  );

  const scmContext = useMemo(() => {
    if (!sourceContextData?.context?.length) {
      return;
    }
    return sourceContextData.context;
  }, [sourceContextData]);

  const effectiveContext = hasEmbeddedContext ? frame.context : scmContext;

  return (
    <FrameContent
      effectiveContext={effectiveContext}
      isLoadingSourceContext={shouldFetchSourceContext && isLoadingSourceContext}
    />
  );
}
