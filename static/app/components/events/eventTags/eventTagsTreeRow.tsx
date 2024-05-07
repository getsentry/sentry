import {Fragment, useState} from 'react';
import styled from '@emotion/styled';
import * as qs from 'query-string';

import {openNavigateToExternalLinkModal} from 'sentry/actionCreators/modal';
import {navigateTo} from 'sentry/actionCreators/navigation';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import type {TagTreeContent} from 'sentry/components/events/eventTags/eventTagsTree';
import EventTagsValue from 'sentry/components/events/eventTags/eventTagsValue';
import {AnnotatedTextErrors} from 'sentry/components/events/meta/annotatedText/annotatedTextErrors';
import Version from 'sentry/components/version';
import VersionHoverCard from 'sentry/components/versionHoverCard';
import {IconEllipsis} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types/event';
import {generateQueryWithTag, isUrl, objectIsEmpty} from 'sentry/utils';
import useOrganization from 'sentry/utils/useOrganization';
import useRouter from 'sentry/utils/useRouter';

interface EventTagTreeRowConfig {
  disableActions?: boolean;
  disableRichValue?: boolean;
}

export interface EventTagsTreeRowProps {
  content: TagTreeContent;
  event: Event;
  projectSlug: string;
  tagKey: string;
  config?: EventTagTreeRowConfig;
  isLast?: boolean;
  spacerCount?: number;
}

export default function EventTagsTreeRow({
  event,
  content,
  tagKey,
  projectSlug,
  spacerCount = 0,
  isLast = false,
  config = {},
  ...props
}: EventTagsTreeRowProps) {
  const organization = useOrganization();
  const originalTag = content.originalTag;
  const tagMeta = content.meta?.value?.[''];
  const tagErrors = tagMeta?.err ?? [];
  const hasTagErrors = tagErrors.length > 0 && !config?.disableActions;
  const hasStem = !isLast && objectIsEmpty(content.subtree);

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
  const tagValue =
    originalTag.key === 'release' && !config?.disableRichValue ? (
      <VersionHoverCard
        organization={organization}
        projectSlug={projectSlug}
        releaseVersion={content.value}
        showUnderline
        underlineColor="linkUnderline"
      >
        <Version version={content.value} truncate />
      </VersionHoverCard>
    ) : (
      <EventTagsValue tag={originalTag} meta={tagMeta} withOnlyFormattedText />
    );

  const tagActions = hasTagErrors ? (
    <TreeValueErrors data-test-id="tag-tree-row-errors">
      <AnnotatedTextErrors errors={tagErrors} />
    </TreeValueErrors>
  ) : (
    <EventTagsTreeRowDropdown content={content} event={event} />
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
        <TreeValue hasErrors={hasTagErrors}>{tagValue}</TreeValue>
        {!config?.disableActions && tagActions}
      </TreeValueTrunk>
    </TreeRow>
  );
}

function EventTagsTreeRowDropdown({
  event,
  content,
}: Pick<EventTagsTreeRowProps, 'content' | 'event'>) {
  const organization = useOrganization();
  const router = useRouter();
  const [isVisible, setIsVisible] = useState(false);
  const originalTag = content.originalTag;

  if (!originalTag) {
    return null;
  }

  const referrer = 'event-tags-tree';
  const query = generateQueryWithTag({referrer}, originalTag);
  const searchQuery = `?${qs.stringify(query)}`;

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
      items={[
        {
          key: 'view-events',
          label: t('View other events with this tag value'),
          hidden: !event.groupID,
          onAction: () => {
            navigateTo(
              `/organizations/${organization.slug}/issues/${event.groupID}/events/${searchQuery}`,
              router
            );
          },
        },
        {
          key: 'view-issues',
          label: t('View issues with this tag value'),
          onAction: () => {
            navigateTo(
              `/organizations/${organization.slug}/issues/${searchQuery}`,
              router
            );
          },
        },
        {
          key: 'release',
          label: t('View this release'),
          hidden: originalTag.key !== 'release',
          onAction: () => {
            navigateTo(
              `/organizations/${organization.slug}/releases/${encodeURIComponent(
                content.value
              )}/`,
              router
            );
          },
        },
        {
          key: 'transaction',
          label: t('View this transaction'),
          hidden: originalTag.key !== 'transaction',
          onAction: () => {
            const transactionQuery = qs.stringify({
              project: event.projectID,
              transaction: content.value,
              referrer,
            });
            navigateTo(
              `/organizations/${organization.slug}/performance/summary/?${transactionQuery}`,
              router
            );
          },
        },
        {
          key: 'replay',
          label: t('View this replay'),
          hidden: originalTag.key !== 'replay_id' && originalTag.key !== 'replayId',
          onAction: () => {
            const replayQuery = qs.stringify({referrer});
            navigateTo(
              `/organizations/${organization.slug}/replays/${encodeURIComponent(content.value)}/?${replayQuery}`,
              router
            );
          },
        },
        {
          key: 'external-link',
          label: t('Visit this external link'),
          hidden: !isUrl(content.value),
          onAction: () => {
            openNavigateToExternalLinkModal({linkText: content.value});
          },
        },
      ]}
    />
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
    p.hasErrors ? p.theme.alert.error.backgroundLight : p.theme.background};
  box-shadow: inset 0 0 0 1px
    ${p => (p.hasErrors ? p.theme.alert.error.border : 'transparent')};
`;

const TreeSpacer = styled('div')<{hasStem: boolean; spacerCount: number}>`
  grid-column: span 1;
  /* Allows TreeBranchIcons to appear connected vertically */
  border-right: 1px solid ${p => (p.hasStem ? p.theme.border : 'transparent')};
  margin-right: -1px;
  height: 100%;
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
  grid-template-columns: ${p =>
    p.spacerCount > 0 ? `${(p.spacerCount - 1) * 20 + 3}px 1rem 1fr` : '1fr'};
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
  font-size: ${p => p.theme.fontSizeSmall};
  word-break: break-word;
  grid-column: span 1;
  color: ${p => (p.hasErrors ? 'inherit' : p.theme.textColor)};
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
  margin: 1px;
  height: 20px;
  .tag-button {
    height: 20px;
    min-height: 20px;
    padding: ${space(0)} ${space(0.75)};
    border-radius: ${space(0.5)};
    z-index: 0;
  }
`;

const TreeValueErrors = styled('div')`
  height: 20px;
  margin-right: ${space(0.75)};
`;
