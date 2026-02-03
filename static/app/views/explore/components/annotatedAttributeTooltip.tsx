import React from 'react';

import {Tooltip} from '@sentry/scraps/tooltip';

import type {Project} from 'sentry/types/project';
import getApiUrl from 'sentry/utils/api/getApiUrl';
import {useApiQuery} from 'sentry/utils/queryClient';
import type {RendererExtra} from 'sentry/views/explore/logs/fieldRenderers';
import {TraceItemMetaInfo} from 'sentry/views/explore/utils';

export function AnnotatedAttributeTooltip({
  children,
  extra,
  fieldKey,
}: {
  children: React.ReactNode;
  extra: Pick<RendererExtra, 'traceItemMeta' | 'organization' | 'project'>;
  fieldKey?: string;
}) {
  // Fetch full project details including `project.relayPiiConfig`
  // That property is not normally available in the store.
  // Taken from FilteredAnnotatedTextValue.tsx
  const {data: projectDetails} = useApiQuery<Project>(
    [
      getApiUrl('/projects/$organizationIdOrSlug/$projectIdOrSlug/', {
        path: {
          organizationIdOrSlug: extra.organization.slug,
          projectIdOrSlug: extra.project?.slug!,
        },
      }),
    ],
    {
      staleTime: Infinity,
      retry: false,
      enabled: !!extra.project?.slug && !!fieldKey && !!extra.traceItemMeta,
      notifyOnChangeProps: ['data'],
    }
  );

  // Check if there's meta information for this field
  if (!fieldKey || !extra.traceItemMeta) {
    return <React.Fragment>{children}</React.Fragment>;
  }

  const metaTooltip = TraceItemMetaInfo.getTooltipText(
    fieldKey,
    extra.traceItemMeta,
    extra.organization,
    projectDetails
  );

  if (!metaTooltip) {
    return <React.Fragment>{children}</React.Fragment>;
  }

  return (
    <Tooltip title={metaTooltip} isHoverable>
      {children}
    </Tooltip>
  );
}
