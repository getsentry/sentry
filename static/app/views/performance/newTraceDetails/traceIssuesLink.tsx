import {Link} from 'sentry/components/core/link/link';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';

import type {TraceTree} from './traceModels/traceTree';
import type {TraceTreeNode} from './traceModels/traceTreeNode';

export function TraceIssuesLink({
  node,
  children,
}: {
  children: React.ReactNode;
  node: TraceTreeNode<TraceTree.NodeValue>;
}) {
  const organization = useOrganization();
  const params = useParams<{traceSlug?: string}>();
  const traceSlug = params.traceSlug?.trim() ?? '';

  // Adding a buffer of 15mins for errors only traces, where there is no concept of
  // trace duration and start equals end timestamps.
  const buffer = node.space[1] > 0 ? 0 : 15 * 60 * 1000;

  return (
    <Link
      to={{
        pathname: `/organizations/${organization.slug}/issues/`,
        query: {
          query: `trace:${traceSlug}`,
          start: new Date(node.space[0] - buffer).toISOString(),
          end: new Date(node.space[0] + node.space[1] + buffer).toISOString(),
          // If we don't pass the project param, the issues page will filter by the last selected project.
          // Traces can have multiple projects, so we query issues by all projects and rely on our search query to filter the results.
          project: -1,
        },
      }}
    >
      {children}
    </Link>
  );
}
