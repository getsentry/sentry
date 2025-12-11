import {Fragment, useState} from 'react';
import styled from '@emotion/styled';
import * as qs from 'query-string';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {openNavigateToExternalLinkModal} from 'sentry/actionCreators/modal';
import {hasEveryAccess} from 'sentry/components/acl/access';
import {ExternalLink, Link} from 'sentry/components/core/link';
import {DropdownMenu, type MenuItemProps} from 'sentry/components/dropdownMenu';
import type {TagTreeContent} from 'sentry/components/events/eventTags/eventTagsTree';
import EventTagsValue from 'sentry/components/events/eventTags/eventTagsValue';
import {AnnotatedTextErrors} from 'sentry/components/events/meta/annotatedText/annotatedTextErrors';
import Version from 'sentry/components/version';
import VersionHoverCard from 'sentry/components/versionHoverCard';
import {IconEllipsis} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types/event';
import type {Project} from 'sentry/types/project';
import {escapeIssueTagKey, generateQueryWithTag} from 'sentry/utils';
import {isEmptyObject} from 'sentry/utils/object/isEmptyObject';
import {useUpdateProject} from 'sentry/utils/project/useUpdateProject';
import {isUrl} from 'sentry/utils/string/isUrl';
import useCopyToClipboard from 'sentry/utils/useCopyToClipboard';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {Tab, TabPaths} from 'sentry/views/issueDetails/types';
import {traceAnalytics} from 'sentry/views/performance/newTraceDetails/traceAnalytics';
import {
  getSearchInExploreTarget,
  TraceDrawerActionKind,
} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/utils';
import {getTransactionSummaryBaseUrl} from 'sentry/views/performance/transactionSummary/utils';
import {makeReleasesPathname} from 'sentry/views/releases/utils/pathnames';
import {makeReplaysPathname} from 'sentry/views/replays/pathnames';

interface EventTagTreeRowConfig {
  // Omits the dropdown of actions applicable to this tag
  disableActions?: boolean;
  // Omit error styling from being displayed, even if context is invalid
  disableErrors?: boolean;
  // Displays tag value as plain text, rather than a hyperlink if applicable
  disableRichValue?: boolean;
}

export interface EventTagsTreeRowProps {
  content: TagTreeContent;
  event: Event;
  project: Project;
  tagKey: string;
  config?: EventTagTreeRowConfig;
  isLast?: boolean;
  spacerCount?: number;
}

export default function EventTagsTreeRow({
  event,
  content,
  tagKey,
  project,
  spacerCount = 0,
  isLast = false,
  config = {},
  ...props
}: EventTagsTreeRowProps) {
  const originalTag = content.originalTag;
  const tagErrors = content.meta?.value?.['']?.err ?? [];
  const hasTagErrors = tagErrors.length > 0 && !config?.disableErrors;
  const hasStem = !isLast && isEmptyObject(content.subtree);

  if (!originalTag) {
    return (
      <TreeRow hasErrors={hasTagErrors} {...props}>
        <TreeKeyTrunk spacerCount={spacerCount}>
          {spacerCount > 0 && (
            <Fragment>
              <TreeSpacer spacerCount={spacerCount} hasStem={hasStem} />
              <TreeBranchIcon hasErrors={hasTagErrors} />
            </Fragment>
          )}
          <TreeKey hasErrors={hasTagErrors}>{tagKey}</TreeKey>
        </TreeKeyTrunk>
        <TreeValueTrunk />
      </TreeRow>
    );
  }

  const tagActions = hasTagErrors ? (
    <TreeValueErrors data-test-id="tag-tree-row-errors">
      <AnnotatedTextErrors errors={tagErrors} />
    </TreeValueErrors>
  ) : (
    <EventTagsTreeRowDropdown content={content} event={event} project={project} />
  );

  return (
    <TreeRow hasErrors={hasTagErrors} {...props}>
      <TreeKeyTrunk spacerCount={spacerCount}>
        {spacerCount > 0 && (
          <Fragment>
            <TreeSpacer spacerCount={spacerCount} hasStem={hasStem} />
            <TreeBranchIcon hasErrors={hasTagErrors} />
          </Fragment>
        )}
        <TreeSearchKey aria-hidden>{originalTag.key}</TreeSearchKey>
        <TreeKey hasErrors={hasTagErrors} title={originalTag.key}>
          {tagKey}
        </TreeKey>
      </TreeKeyTrunk>
      <TreeValueTrunk>
        <TreeValue hasErrors={hasTagErrors}>
          <EventTagsTreeValue
            config={config}
            content={content}
            event={event}
            project={project}
          />
        </TreeValue>
        {!config?.disableActions && tagActions}
      </TreeValueTrunk>
    </TreeRow>
  );
}

function EventTagsTreeRowDropdown({
  content,
  event,
  project,
}: Pick<EventTagsTreeRowProps, 'content' | 'event' | 'project'>) {
  const location = useLocation();
  const organization = useOrganization();
  const hasExploreEnabled = organization.features.includes('visibility-explore-view');
  const {copy} = useCopyToClipboard();
  const {mutate: saveTag} = useUpdateProject(project);
  const [isVisible, setIsVisible] = useState(false);
  const originalTag = content.originalTag;

  if (!originalTag) {
    return null;
  }

  const referrer = 'event-tags-table';
  const highlightTagSet = new Set(project?.highlightTags ?? []);
  const hideAddHighlightsOption =
    // Check for existing highlight record to prevent replacing all with a single tag if we receive a project summary (instead of a detailed project)
    project?.highlightTags &&
    // Skip tags already highlighted
    highlightTagSet.has(originalTag.key);
  const query = generateQueryWithTag(
    {referrer},
    {
      ...originalTag,
      key: escapeIssueTagKey(originalTag.key),
    }
  );

  const isProjectAdmin = hasEveryAccess(['project:admin'], {
    organization,
    project,
  });
  const isIssueDetailsRoute = location.pathname.includes(`issues/${event.groupID}/`);
  const isFeedback = Boolean(event.contexts.feedback);

  const items: MenuItemProps[] = [
    {
      key: 'tag-details',
      label: t('Tag breakdown'),
      hidden: !isIssueDetailsRoute,
      to: {
        pathname: `/organizations/${organization.slug}/issues/${event.groupID}/${TabPaths[Tab.DISTRIBUTIONS]}${encodeURIComponent(originalTag.key)}/`,
        query: location.query,
      },
    },
    {
      key: 'view-events',
      label: t('View other events with this tag value'),
      hidden: !event.groupID || isFeedback,
      to: {
        pathname: `/organizations/${organization.slug}/issues/${event.groupID}/events/`,
        query,
      },
    },
    {
      key: 'view-issues',
      label: t('Search issues with this tag value'),
      hidden: isFeedback,
      to: {
        pathname: `/organizations/${organization.slug}/issues/`,
        query,
      },
    },
    {
      key: 'view-feedback',
      label: t('Search feedback with this tag value'),
      hidden: !isFeedback,
      to: {
        pathname: `/organizations/${organization.slug}/feedback/`,
        query,
      },
    },
    {
      key: 'view-traces',
      label: t('Find more samples with this value'),
      hidden: !hasExploreEnabled || isFeedback,
      to: getSearchInExploreTarget(
        organization,
        location,
        project.id,
        originalTag.key,
        originalTag.value,
        TraceDrawerActionKind.INCLUDE
      ),
      onAction: () => {
        traceAnalytics.trackExploreSearch(
          organization,
          originalTag.key,
          originalTag.value,
          TraceDrawerActionKind.INCLUDE,
          'drawer'
        );
      },
    },
    {
      key: 'copy-value',
      label: t('Copy tag value to clipboard'),
      onAction: () =>
        copy(content.value, {successMessage: t('Tag value copied to clipboard.')}),
    },
    {
      key: 'add-to-highlights',
      label: t('Add to event highlights'),
      hidden: hideAddHighlightsOption || !isProjectAdmin || isFeedback,
      onAction: () => {
        saveTag(
          {
            highlightTags: [...(project?.highlightTags ?? []), originalTag.key],
          },
          {
            onError: () => {
              addErrorMessage(
                tct(`Failed to update '[projectName]' project`, {
                  projectName: project.name,
                })
              );
            },
            onSuccess: () => {
              addSuccessMessage(
                tct(`Successfully updated '[projectName]' project`, {
                  projectName: project.name,
                })
              );
            },
          }
        );
      },
    },
    {
      key: 'release',
      label: t('View this release'),
      hidden: originalTag.key !== 'release',
      to:
        originalTag.key === 'release'
          ? makeReleasesPathname({
              organization,
              path: `/${encodeURIComponent(content.value)}/`,
            })
          : undefined,
    },
    {
      key: 'transaction',
      label: t('View this transaction'),
      hidden: originalTag.key !== 'transaction',
      to:
        originalTag.key === 'transaction'
          ? {
              pathname: `${getTransactionSummaryBaseUrl(organization)}/`,
              query: {
                project: event.projectID,
                transaction: content.value,
                referrer,
              },
            }
          : undefined,
    },
    {
      key: 'replay',
      label: t('View this replay'),
      hidden: originalTag.key !== 'replay_id' && originalTag.key !== 'replayId',
      to:
        originalTag.key === 'replay_id' || originalTag.key === 'replayId'
          ? {
              pathname: makeReplaysPathname({
                path: `/${encodeURIComponent(content.value)}/`,
                organization,
              }),
              query: {referrer},
            }
          : undefined,
    },
    {
      key: 'external-link',
      label: t('Visit this external link'),
      hidden: !isUrl(content.value),
      onAction: () => {
        openNavigateToExternalLinkModal({linkText: content.value});
      },
    },
  ];

  return (
    <TreeValueDropdown
      preventOverflowOptions={{padding: 4}}
      className={isVisible ? '' : 'invisible'}
      position="bottom-end"
      size="xs"
      onOpenChange={isOpen => setIsVisible(isOpen)}
      triggerProps={{
        'aria-label': t('Tag Actions Menu'),
        icon: <IconEllipsis />,
        showChevron: false,
        className: 'tag-button',
      }}
      items={items}
    />
  );
}

function EventTagsTreeValue({
  config,
  content,
  event,
  project,
}: Pick<EventTagsTreeRowProps, 'config' | 'content' | 'event' | 'project'>) {
  const organization = useOrganization();
  const {originalTag} = content;
  const tagMeta = content.meta?.value?.[''];
  if (!originalTag) {
    return null;
  }

  const defaultValue = (
    <EventTagsValue tag={originalTag} meta={tagMeta} withOnlyFormattedText />
  );

  if (config?.disableRichValue) {
    return defaultValue;
  }

  let tagValue = defaultValue;
  const referrer = 'event-tags-table';
  switch (originalTag.key) {
    case 'release':
      tagValue = (
        <VersionHoverCard
          organization={organization}
          projectSlug={project.slug}
          releaseVersion={content.value}
          showUnderline
          underlineColor="linkUnderline"
        >
          <Version version={content.value} truncate shouldWrapText />
        </VersionHoverCard>
      );
      break;
    case 'transaction': {
      const transactionQuery = qs.stringify({
        project: event.projectID,
        transaction: content.value,
        referrer,
      });
      const transactionDestination = `${getTransactionSummaryBaseUrl(organization)}/?${transactionQuery}`;
      tagValue = (
        <TagLinkText>
          <Link to={transactionDestination}>{content.value}</Link>
        </TagLinkText>
      );
      break;
    }
    case 'replayId':
    case 'replay_id': {
      const replayPath = makeReplaysPathname({
        path: `/${encodeURIComponent(content.value)}/`,
        organization,
      });
      tagValue = (
        <TagLinkText>
          <Link
            to={{
              pathname: replayPath,
              query: {referrer},
            }}
          >
            {content.value}
          </Link>
        </TagLinkText>
      );
      break;
    }
    default:
      tagValue = defaultValue;
  }

  return isUrl(content.value) ? (
    <TagLinkText>
      <ExternalLink
        onClick={e => {
          e.preventDefault();
          openNavigateToExternalLinkModal({linkText: content.value});
        }}
      >
        {content.value}
      </ExternalLink>
    </TagLinkText>
  ) : (
    tagValue
  );
}

const TreeRow = styled('div')<{hasErrors: boolean}>`
  border-radius: ${space(0.5)};
  padding-left: ${space(1)};
  position: relative;
  display: grid;
  align-items: center;
  grid-column: span 2;
  column-gap: ${space(1.5)};
  grid-template-columns: subgrid;
  :nth-child(odd) {
    background-color: ${p =>
      p.hasErrors ? p.theme.alert.error.backgroundLight : p.theme.backgroundSecondary};
  }
  .invisible {
    visibility: hidden;
  }
  &:hover,
  &:active {
    .invisible {
      visibility: visible;
    }
  }
  color: ${p => (p.hasErrors ? p.theme.alert.error.color : p.theme.subText)};
  background-color: ${p =>
    p.hasErrors
      ? p.theme.alert.error.backgroundLight
      : p.theme.tokens.background.primary};
  box-shadow: inset 0 0 0 1px
    ${p => (p.hasErrors ? p.theme.alert.error.border : 'transparent')};
`;

const TreeSpacer = styled('div')<{hasStem: boolean; spacerCount: number}>`
  grid-column: span 1;
  /* Allows TreeBranchIcons to appear connected vertically */
  border-right: 1px solid ${p => (p.hasStem ? p.theme.border : 'transparent')};
  margin-right: -1px;
  height: 100%;
  width: ${p => (p.spacerCount - 1) * 20 + 3}px;
`;

const TreeBranchIcon = styled('div')<{hasErrors: boolean}>`
  border: 1px solid ${p => (p.hasErrors ? p.theme.alert.error.border : p.theme.border)};
  border-width: 0 0 1px 1px;
  border-radius: 0 0 0 5px;
  grid-column: span 1;
  height: 12px;
  align-self: start;
  margin-right: ${space(0.5)};
`;

const TreeKeyTrunk = styled('div')<{spacerCount: number}>`
  grid-column: 1 / 2;
  display: grid;
  height: 100%;
  align-items: center;
  grid-template-columns: ${p => (p.spacerCount > 0 ? `auto 1rem 1fr` : '1fr')};
`;

const TreeValueTrunk = styled('div')`
  grid-column: 2 / 3;
  display: grid;
  height: 100%;
  align-items: center;
  min-height: 22px;
  grid-template-columns: 1fr auto;
  grid-column-gap: ${space(0.5)};
`;

const TreeValue = styled('div')<{hasErrors?: boolean}>`
  padding: ${space(0.25)} 0;
  align-self: start;
  font-family: ${p => p.theme.text.familyMono};
  font-size: ${p => p.theme.fontSize.sm};
  word-break: break-word;
  grid-column: span 1;
  color: ${p => (p.hasErrors ? 'inherit' : p.theme.tokens.content.primary)};
`;

const TreeKey = styled(TreeValue)<{hasErrors?: boolean}>`
  color: ${p => (p.hasErrors ? 'inherit' : p.theme.subText)};
`;

/**
 * Hidden element to allow browser searching for exact key name
 */
const TreeSearchKey = styled('span')`
  font-size: 0;
  position: absolute;
`;

const TreeValueDropdown = styled(DropdownMenu)`
  display: block;
  margin: 1px;
  height: 20px;
  .tag-button {
    height: 20px;
    min-height: 20px;
    padding: 0 ${space(0.75)};
    border-radius: ${space(0.5)};
    z-index: 0;
  }
`;

const TreeValueErrors = styled('div')`
  height: 20px;
  margin-right: ${space(0.75)};
`;

const TagLinkText = styled('span')`
  color: ${p => p.theme.linkColor};
  text-decoration: ${p => p.theme.linkUnderline} underline dotted;
  margin: 0;
  &:hover,
  &:focus {
    text-decoration: none;
  }
`;
