import {IconOpen} from '@sentry/icons/open';
import type {Location} from 'history';

import {Tag} from '@sentry/scraps/badge';
import {Button} from '@sentry/scraps/button';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {
  TraceItemResponseAttribute,
  TraceItemResponseLink,
} from 'sentry/views/explore/hooks/useTraceItemDetails';
import {FoldSection} from 'sentry/views/issueDetails/foldSection';
import {
  getPageServerRendering,
  type ServerRender,
  type ServerRenderingType,
  type StaticPart,
} from 'sentry/views/performance/traceDetails/serverRendering/serverRendering';
import {TraceDrawerComponents} from 'sentry/views/performance/traceDetails/traceDrawer/details/styles';
import type {TraceTree} from 'sentry/views/performance/traceDetails/traceModels/traceTree';
import type {BaseNode} from 'sentry/views/performance/traceDetails/traceModels/traceTreeNode/baseNode';
import type {EapSpanNode} from 'sentry/views/performance/traceDetails/traceModels/traceTreeNode/eapSpanNode';

import {useLinkedSpanTarget} from './useLinkedSpanTarget';

export interface ServerRenderingSectionProps {
  attributes: TraceItemResponseAttribute[];
  location: Location;
  /** The pageload span. */
  node: EapSpanNode;
  onTabScrollToNode: (node: BaseNode) => void;
  organization: Organization;
  links?: TraceItemResponseLink[];
  tree?: TraceTree;
}

/** What the actions need to open or select the spans of a render. */
type RenderActionProps = Pick<
  ServerRenderingSectionProps,
  'location' | 'node' | 'onTabScrollToNode' | 'organization' | 'tree'
>;

/**
 * Shows which parts of the page the server reused and which it rendered for this
 * page load. The reused part wraps the request part, like a static shell wraps
 * its dynamic holes.
 */
export function ServerRenderingSection(props: ServerRenderingSectionProps) {
  const serverRendering = getPageServerRendering({
    op: props.node.op,
    attributes: props.attributes,
    links: props.links,
  });

  if (!serverRendering) {
    return null;
  }

  const {sharedRender, requestRender} = serverRendering;
  const requestBlock = requestRender ? (
    <RequestBlock {...props} render={requestRender} hasReusedPart={!!sharedRender} />
  ) : null;

  return (
    <FoldSection
      sectionKey="server-rendering"
      disableCollapsePersistence
      title={<SectionTitle type={serverRendering.type} />}
    >
      {sharedRender ? (
        <Stack
          gap="md"
          padding="md"
          radius="md"
          background="secondary"
          border="primary"
          // Dashed, because the spans of a reused part are never in this trace.
          // The border prop only draws solid lines.
          style={{borderStyle: 'dashed'}}
        >
          <BlockHeader
            title={getReusedPartTitle(sharedRender.part)}
            subtitle={t('Rendered earlier and reused')}
            action={<RenderAction {...props} render={sharedRender} />}
          />
          {requestBlock}
        </Stack>
      ) : (
        requestBlock
      )}
    </FoldSection>
  );
}

const TYPE_LABELS: Record<ServerRenderingType, string> = {
  static: t('Static'),
  partially_static: t('Partially static'),
};

function getReusedPartTitle(part: StaticPart | undefined): string {
  switch (part) {
    case 'whole_page':
      return t('Whole page');
    case 'static_part':
      return t('Static part');
    default:
      return t('Reused part');
  }
}

function SectionTitle({type}: {type: ServerRenderingType | undefined}) {
  return (
    <Flex gap="sm" align="center">
      <TraceDrawerComponents.SectionTitleWithQuestionTooltip
        title={t('Server Rendering')}
        tooltipText={t(
          'Where the server spans of this page are. A reused part has its spans in the trace that rendered it.'
        )}
      />
      {type ? <Tag variant="muted">{TYPE_LABELS[type]}</Tag> : null}
    </Flex>
  );
}

function RequestBlock({
  render,
  hasReusedPart,
  ...props
}: RenderActionProps & {hasReusedPart: boolean; render: ServerRender}) {
  return (
    <Stack padding="md" radius="md" border="primary" background="primary">
      <BlockHeader
        // Not "Page": framework users can read that as a page file.
        title={hasReusedPart ? t('Dynamic part') : t('Server request')}
        subtitle={getRequestSubtitle(render, hasReusedPart)}
        action={<RenderAction {...props} render={render} />}
      />
    </Stack>
  );
}

/**
 * Says "for this page load" only next to a reused part. Without one, the page can
 * still have a build-time shell that SDKs cannot mark.
 */
function getRequestSubtitle(render: ServerRender, hasReusedPart: boolean): string {
  const isInOtherTrace = render.location.type !== 'this_trace';
  if (hasReusedPart) {
    return isInOtherTrace
      ? t('Rendered for this page load, in another trace')
      : t('Rendered for this page load');
  }
  return isInOtherTrace ? t('In another trace') : t('In this trace');
}

function BlockHeader({
  title,
  subtitle,
  action,
}: {
  action: React.ReactNode;
  subtitle: string;
  title: string;
}) {
  return (
    <Flex justify="between" align="start" gap="md">
      <Stack gap="2xs">
        <Text bold>{title}</Text>
        <Text size="sm" variant="muted">
          {subtitle}
        </Text>
      </Stack>
      <Text size="sm" wrap="nowrap">
        {action}
      </Text>
    </Flex>
  );
}

/** "Open trace" leaves this trace, "Go to span" stays in it. */
function RenderAction({render, ...props}: RenderActionProps & {render: ServerRender}) {
  switch (render.location.type) {
    case 'other_trace':
      return <OpenTraceLink {...props} link={render.location.link} />;
    case 'this_trace':
      return <GoToSpanButton {...props} />;
    case 'not_sampled':
      return <Text variant="muted">{t('Not sampled')}</Text>;
    case 'not_traced':
      return <Text variant="muted">{t('No linked trace')}</Text>;
  }
}

function OpenTraceLink({
  link,
  ...props
}: RenderActionProps & {link: TraceItemResponseLink}) {
  // The link has no render time, so the trace query searches around the pageload
  // start. It does not find renders much older than that.
  const linkedSpan = useLinkedSpanTarget({
    ...props,
    link,
    timestamp: props.node.value.start_timestamp,
  });

  return (
    <Link to={linkedSpan.to} onClick={linkedSpan.onClick}>
      {t('Open trace')} <IconOpen size="xs" />
    </Link>
  );
}

function GoToSpanButton({node, onTabScrollToNode}: RenderActionProps) {
  // The tree moves the server request of the page below its pageload and marks it.
  // Other server spans below the pageload, such as API requests, have no mark.
  const serverNode = node.findChild(
    child =>
      child.op === 'http.server' && child.reparent_reason === 'pageload server handler'
  );
  if (!serverNode) {
    return null;
  }

  return (
    <Button variant="link" size="zero" onClick={() => onTabScrollToNode(serverNode)}>
      {t('Go to span')}
    </Button>
  );
}
