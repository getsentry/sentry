import {useState} from 'react';
import styled from '@emotion/styled';
import * as qs from 'query-string';

import type {MenuItemProps} from '@sentry/scraps/dropdownMenu';
import {ExternalLink, Link} from '@sentry/scraps/link';
import {RevealOnHover} from '@sentry/scraps/revealOnHover';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {openNavigateToExternalLinkModal} from 'sentry/actionCreators/modal';
import {hasEveryAccess} from 'sentry/components/acl/access';
import type {TagTreeContent} from 'sentry/components/events/eventTags/eventTagsTree';
import {EventTagsValue} from 'sentry/components/events/eventTags/eventTagsValue';
import {AnnotatedTextErrors} from 'sentry/components/events/meta/annotatedText/annotatedTextErrors';
import {KeyValueTreeRow} from 'sentry/components/keyValueTree/keyValueTreeRow';
import {
  TREE_VALUE_DROPDOWN_BUTTON_CLASS,
  TreeValueDropdown,
} from 'sentry/components/keyValueTree/styles';
import {extractSelectionParameters} from 'sentry/components/pageFilters/parse';
import {Version} from 'sentry/components/version';
import {VersionHoverCard} from 'sentry/components/versionHoverCard';
import {IconEllipsis} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import type {DetailedProject} from 'sentry/types/project';
import {useUpdateProject} from 'sentry/utils/project/useUpdateProject';
import {escapeIssueTagKey, generateQueryWithTag} from 'sentry/utils/queryString';
import {isValidUrl} from 'sentry/utils/string/isValidUrl';
import {useCopyToClipboard} from 'sentry/utils/useCopyToClipboard';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {makeReleasesPathname} from 'sentry/views/explore/releases/utils/pathnames';
import {makeReplaysPathname} from 'sentry/views/explore/replays/pathnames';
import {Tab, TabPaths} from 'sentry/views/issueDetails/types';
import {traceAnalytics} from 'sentry/views/performance/traceDetails/traceAnalytics';
import {
  getSearchInExploreTarget,
  TraceDrawerActionKind,
} from 'sentry/views/performance/traceDetails/traceDrawer/details/utils';
import {getTransactionSummaryBaseUrl} from 'sentry/views/performance/transactionSummary/utils';
import {getSizeBuildPath} from 'sentry/views/preprod/utils/buildLinkUtils';

export interface EventTagTreeRowConfig {
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
  project: DetailedProject;
  tagKey: string;
  config?: EventTagTreeRowConfig;
  isLast?: boolean;
  spacerCount?: number;
}

export function EventTagsTreeRow({
  event,
  content,
  tagKey,
  project,
  spacerCount = 0,
  isLast = false,
  config = {},
  ...props
}: EventTagsTreeRowProps) {
  const originalTag = content.original;
  const tagErrors = content.meta?.value?.['']?.err ?? [];
  const hasTagErrors = tagErrors.length > 0 && !config?.disableErrors;
  const hasStem = !isLast && content.subtree.size === 0;

  if (!originalTag) {
    return (
      <KeyValueTreeRow
        {...props}
        hasErrors={hasTagErrors}
        hasStem={hasStem}
        label={tagKey}
        spacerCount={spacerCount}
      />
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
    <KeyValueTreeRow
      {...props}
      actions={config?.disableActions ? undefined : tagActions}
      hasErrors={hasTagErrors}
      hasStem={hasStem}
      label={tagKey}
      labelTitle={originalTag.key}
      searchKey={originalTag.key}
      spacerCount={spacerCount}
      value={
        <EventTagsTreeValue
          config={config}
          content={content}
          event={event}
          project={project}
        />
      }
    />
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
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const originalTag = content.original;

  if (!originalTag) {
    return null;
  }

  const referrer = 'event-tags-table';
  const highlightTagSet = new Set(project?.highlightTags);
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
  const globalSelectionParams = extractSelectionParameters(location.query);

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
        query: {...globalSelectionParams, ...query},
      },
    },
    {
      key: 'view-issues',
      label: t('Search issues with this tag value'),
      hidden: isFeedback,
      to: {
        pathname: `/organizations/${organization.slug}/issues/`,
        query: {...globalSelectionParams, ...query},
      },
    },
    {
      key: 'view-feedback',
      label: t('Search feedback with this tag value'),
      hidden: !isFeedback,
      to: {
        pathname: `/organizations/${organization.slug}/issues/feedback/`,
        query: {...globalSelectionParams, ...query},
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
                tct("Failed to update '[projectName]' project", {
                  projectName: project.name,
                })
              );
            },
            onSuccess: () => {
              addSuccessMessage(
                tct("Successfully updated '[projectName]' project", {
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
      hidden: !isValidUrl(content.value),
      onAction: () => {
        openNavigateToExternalLinkModal({linkText: content.value});
      },
    },
  ];

  return (
    <RevealOnHover.Action visible={isMenuOpen}>
      <TreeValueDropdown
        preventOverflowOptions={{padding: 4}}
        position="bottom-end"
        size="xs"
        isOpen={isMenuOpen}
        onOpenChange={setIsMenuOpen}
        triggerProps={{
          'aria-label': t('Tag Actions Menu'),
          icon: <IconEllipsis />,
          showChevron: false,
          className: TREE_VALUE_DROPDOWN_BUTTON_CLASS,
        }}
        items={items}
      />
    </RevealOnHover.Action>
  );
}

function EventTagsTreeValue({
  config,
  content,
  event,
  project,
}: Pick<EventTagsTreeRowProps, 'config' | 'content' | 'event' | 'project'>) {
  const organization = useOrganization();
  const originalTag = content.original;
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
          underlineColor="muted"
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
    case 'head.artifact_id':
    case 'base.artifact_id': {
      const buildPath = getSizeBuildPath({
        organizationSlug: organization.slug,
        baseArtifactId: content.value,
      });
      if (buildPath) {
        tagValue = (
          <TagLinkText>
            <Link to={buildPath}>{content.value}</Link>
          </TagLinkText>
        );
      }
      break;
    }
    default:
      tagValue = defaultValue;
  }

  return isValidUrl(content.value) ? (
    <TagLinkText>
      <ExternalLink
        tabIndex={0}
        onClick={e => {
          e.preventDefault();
          openNavigateToExternalLinkModal({linkText: content.value});
        }}
        onKeyDown={e => {
          if (e.key === 'Enter') {
            e.preventDefault();
            openNavigateToExternalLinkModal({linkText: content.value});
          }
        }}
      >
        {content.value}
      </ExternalLink>
    </TagLinkText>
  ) : (
    tagValue
  );
}

const TreeValueErrors = styled('div')`
  height: 20px;
  margin-right: ${p => p.theme.space.sm};
`;

const TagLinkText = styled('span')`
  color: ${p => p.theme.tokens.interactive.link.accent.rest};
  text-decoration: ${p => p.theme.tokens.interactive.link.accent.rest} underline dotted;
  margin: 0;
  &:hover,
  &:focus {
    text-decoration: none;
  }
`;
