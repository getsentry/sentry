import {Fragment} from 'react';
import styled from '@emotion/styled';

import ProjectAvatar from 'sentry/components/avatar/projectAvatar';
import {CopyToClipboardButton} from 'sentry/components/copyToClipboardButton';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import ErrorBoundary from 'sentry/components/errorBoundary';
import Section from 'sentry/components/feedback/feedbackItem/feedbackItemSection';
import FeedbackItemUsername from 'sentry/components/feedback/feedbackItem/feedbackItemUsername';
import FeedbackViewers from 'sentry/components/feedback/feedbackItem/feedbackViewers';
import ReplaySection from 'sentry/components/feedback/feedbackItem/replaySection';
import TagsSection from 'sentry/components/feedback/feedbackItem/tagsSection';
import useMarkRead from 'sentry/components/feedback/feedbackItem/useMarkAsRead';
import useUpdateFeedback from 'sentry/components/feedback/feedbackItem/useUpdateFeedback';
import ObjectInspector from 'sentry/components/objectInspector';
import PanelItem from 'sentry/components/panels/panelItem';
import {Flex} from 'sentry/components/profiling/flex';
import TextCopyInput from 'sentry/components/textCopyInput';
import {IconEllipsis, IconJson, IconLink} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Event, GroupStatus} from 'sentry/types';
import type {HydratedFeedbackItem} from 'sentry/utils/feedback/item/types';
import useOrganization from 'sentry/utils/useOrganization';

interface Props {
  eventData: Event | undefined;
  feedbackItem: HydratedFeedbackItem;
  replayId: string;
  tags: Record<string, string>;
}

export default function FeedbackItem({feedbackItem, eventData, tags, replayId}: Props) {
  const organization = useOrganization();
  const {onSetStatus} = useUpdateFeedback({feedbackItem});
  const {markAsRead} = useMarkRead({feedbackItem});
  const url = eventData?.tags.find(tag => tag.key === 'url');

  return (
    <Fragment>
      <HeaderPanelItem>
        <Flex gap={space(2)} justify="space-between">
          <Flex column>
            <Flex align="center" gap={space(0.5)}>
              <FeedbackItemUsername feedbackItem={feedbackItem} detailDisplay />
              {feedbackItem.metadata.contact_email ? (
                <CopyToClipboardButton
                  size="xs"
                  iconSize="xs"
                  text={feedbackItem.metadata.contact_email}
                />
              ) : null}
            </Flex>
            <Flex gap={space(1)}>
              <Flex align="center" gap={space(0.5)}>
                <ProjectAvatar
                  project={feedbackItem.project}
                  size={12}
                  title={feedbackItem.project.slug}
                />
                {feedbackItem.project.slug}
              </Flex>
            </Flex>
          </Flex>
          <Flex gap={space(1)} align="center">
            <ErrorBoundary mini>
              <FeedbackViewers feedbackItem={feedbackItem} />
            </ErrorBoundary>
            <ErrorBoundary mini>
              <DropdownMenu
                position="bottom-end"
                triggerLabel={
                  feedbackItem.status === GroupStatus.IGNORED
                    ? t('Archived')
                    : feedbackItem.status === GroupStatus.RESOLVED
                    ? t('Resolved')
                    : t('Unresolved')
                }
                triggerProps={{
                  'aria-label': t('Resolve or Archive Menu'),
                  showChevron: true,
                  size: 'xs',
                }}
                items={[
                  {
                    key: 'resolve',
                    label:
                      feedbackItem.status === GroupStatus.RESOLVED
                        ? t('Unresolve')
                        : t('Resolve'),
                    onAction: () =>
                      onSetStatus(
                        feedbackItem.status === GroupStatus.RESOLVED
                          ? GroupStatus.UNRESOLVED
                          : GroupStatus.RESOLVED
                      ),
                  },
                  {
                    key: 'archive',
                    label:
                      feedbackItem.status === GroupStatus.IGNORED
                        ? t('Unarchive')
                        : t('Archive'),
                    onAction: () =>
                      onSetStatus(
                        feedbackItem.status === GroupStatus.IGNORED
                          ? GroupStatus.UNRESOLVED
                          : GroupStatus.IGNORED
                      ),
                  },
                ]}
              />
            </ErrorBoundary>
            <ErrorBoundary mini>
              <DropdownMenu
                position="bottom-end"
                triggerProps={{
                  'aria-label': t('Read Menu'),
                  icon: <IconEllipsis size="xs" />,
                  showChevron: false,
                  size: 'xs',
                }}
                items={[
                  {
                    key: 'mark read',
                    label: t('Mark as read'),
                    onAction: () => markAsRead(true),
                  },
                  {
                    key: 'mark unread',
                    label: t('Mark as unread'),
                    onAction: () => markAsRead(false),
                  },
                ]}
              />
            </ErrorBoundary>
          </Flex>
        </Flex>
      </HeaderPanelItem>
      <OverflowPanelItem>
        <Section title={t('Description')}>
          <Blockquote>
            <pre>{feedbackItem.metadata.message}</pre>
          </Blockquote>
        </Section>

        <Section icon={<IconLink size="xs" />} title={t('Url')}>
          <ErrorBoundary mini>
            <TextCopyInput size="sm">{url?.value ?? t('URL not found')}</TextCopyInput>
          </ErrorBoundary>
        </Section>

        {replayId ? (
          <ReplaySection organization={organization} replayId={replayId} />
        ) : null}

        <TagsSection tags={tags} />

        <Section icon={<IconJson size="xs" />} title={t('Raw Issue Data')}>
          <ObjectInspector
            data={feedbackItem}
            expandLevel={3}
            theme={{
              TREENODE_FONT_SIZE: '0.7rem',
              ARROW_FONT_SIZE: '0.5rem',
            }}
          />
        </Section>
        <Section icon={<IconJson size="xs" />} title={t('Raw Event Data')}>
          <ObjectInspector
            data={eventData}
            expandLevel={3}
            theme={{
              TREENODE_FONT_SIZE: '0.7rem',
              ARROW_FONT_SIZE: '0.5rem',
            }}
          />
        </Section>
      </OverflowPanelItem>
    </Fragment>
  );
}

const HeaderPanelItem = styled(PanelItem)`
  display: grid;
  padding: ${space(1)} ${space(2)};
`;

const OverflowPanelItem = styled(PanelItem)`
  overflow: scroll;

  flex-direction: column;
  flex-grow: 1;
  gap: ${space(3)};
`;

const Blockquote = styled('blockquote')`
  margin: 0 ${space(4)};
  position: relative;

  &::before {
    position: absolute;
    color: ${p => p.theme.purple300};
    content: '❝';
    font-size: ${space(4)};
    left: -${space(4)};
    top: -0.4rem;
  }
  &::after {
    position: absolute;
    border: 1px solid ${p => p.theme.purple300};
    bottom: 0;
    content: '';
    left: -${space(1)};
    top: 0;
  }

  & > pre {
    margin: 0;
    background: none;
    font-family: inherit;
    font-size: ${p => p.theme.fontSizeMedium};
    line-height: 1.6;
    padding: 0;
    word-break: break-word;
  }
`;
