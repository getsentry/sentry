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
import ResolveButton from 'sentry/components/feedback/feedbackItem/resolveButton';
import TagsSection from 'sentry/components/feedback/feedbackItem/tagsSection';
import useDeleteFeedback from 'sentry/components/feedback/feedbackItem/useDeleteFeedback';
import ObjectInspector from 'sentry/components/objectInspector';
import PanelItem from 'sentry/components/panels/panelItem';
import {Flex} from 'sentry/components/profiling/flex';
import TextCopyInput from 'sentry/components/textCopyInput';
import {IconChevron, IconEllipsis, IconJson, IconLink} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {getShortEventId} from 'sentry/utils/events';
import type {HydratedFeedbackItem} from 'sentry/utils/feedback/item/types';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';

interface Props {
  feedbackItem: HydratedFeedbackItem;
}

export default function FeedbackItem({feedbackItem}: Props) {
  const organization = useOrganization();
  const {projects} = useProjects();
  const {onDelete} = useDeleteFeedback({
    feedbackItem,
  });

  const project = projects.find(p => p.id === String(feedbackItem.project_id));
  if (!project) {
    return null;
  }
  const slug = project?.slug;

  return (
    <Fragment>
      <HeaderPanelItem>
        <Flex gap={space(2)} justify="space-between">
          <Flex column>
            <Flex align="center" gap={space(0.5)}>
              <FeedbackItemUsername feedbackItem={feedbackItem} detailDisplay />
              {feedbackItem.contact_email ? (
                <CopyToClipboardButton
                  size="xs"
                  iconSize="xs"
                  text={feedbackItem.contact_email}
                />
              ) : null}
            </Flex>
            <Flex gap={space(1)}>
              <Flex align="center" gap={space(0.5)}>
                <ProjectAvatar project={project} size={12} title={slug} /> {slug}
              </Flex>
              <Flex align="center" gap={space(1)}>
                <IconChevron direction="right" size="xs" />
                <Flex>{getShortEventId(feedbackItem.feedback_id)}</Flex>
              </Flex>
            </Flex>
          </Flex>
          <Flex gap={space(1)} align="center">
            <ErrorBoundary mini>
              <FeedbackViewers feedbackItem={feedbackItem} />
            </ErrorBoundary>
            <ErrorBoundary mini>
              <ResolveButton feedbackItem={feedbackItem} />
            </ErrorBoundary>
            <ErrorBoundary mini>
              <DropdownMenu
                position="bottom-end"
                triggerProps={{
                  'aria-label': t('Feedback Actions Menu'),
                  icon: <IconEllipsis size="xs" />,
                  showChevron: false,
                  size: 'xs',
                }}
                items={[
                  {
                    key: 'mark read',
                    label: t('Mark as read'),
                    onAction: () => {},
                  },
                  {
                    key: 'mark unread',
                    label: t('Mark as unread'),
                    onAction: () => {},
                  },
                  {
                    key: 'delete',
                    label: t('Delete'),
                    onAction: onDelete,
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
            <pre>{feedbackItem.message}</pre>
          </Blockquote>
        </Section>

        <Section icon={<IconLink size="xs" />} title={t('Url')}>
          <ErrorBoundary mini>
            <TextCopyInput size="sm">{feedbackItem.url}</TextCopyInput>
          </ErrorBoundary>
        </Section>

        {feedbackItem.replay_id ? (
          <ReplaySection organization={organization} replayId={feedbackItem.replay_id} />
        ) : null}

        <TagsSection tags={feedbackItem.tags} />

        <Section icon={<IconJson size="xs" />} title={t('Raw')}>
          <ObjectInspector
            data={feedbackItem}
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
