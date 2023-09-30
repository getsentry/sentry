import {Fragment} from 'react';
import styled from '@emotion/styled';

import {CopyToClipboardButton} from 'sentry/components/copyToClipboardButton';
import ErrorBoundary from 'sentry/components/errorBoundary';
import Section from 'sentry/components/feedback/feedbackItem/feedbackItemSection';
import FeedbackItemUsername from 'sentry/components/feedback/feedbackItem/feedbackItemUsername';
import FeedbackViewers from 'sentry/components/feedback/feedbackItem/feedbackViewers';
import ReplaySection from 'sentry/components/feedback/feedbackItem/replaySection';
import ResolveButton from 'sentry/components/feedback/feedbackItem/resolveButton';
import TagsSection from 'sentry/components/feedback/feedbackItem/tagsSection';
import ObjectInspector from 'sentry/components/objectInspector';
import PanelItem from 'sentry/components/panels/panelItem';
import {Flex} from 'sentry/components/profiling/flex';
import TextCopyInput from 'sentry/components/textCopyInput';
import {IconJson, IconLink} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {HydratedFeedbackItem} from 'sentry/utils/feedback/item/types';
import useOrganization from 'sentry/utils/useOrganization';

interface Props {
  feedbackItem: HydratedFeedbackItem;
}

export default function FeedbackItem({feedbackItem}: Props) {
  const organization = useOrganization();

  return (
    <Fragment>
      <HeaderPanelItem>
        <Flex gap={space(2)} justify="space-between">
          <Flex gap={space(1)} align="center">
            <FeedbackItemUsername feedbackItem={feedbackItem} />
            {feedbackItem.contact_email ? (
              <CopyToClipboardButton
                size="xs"
                iconSize="xs"
                text={feedbackItem.contact_email}
              />
            ) : null}
          </Flex>

          <Flex gap={space(1)} align="center">
            <ErrorBoundary mini>
              <FeedbackViewers feedbackItem={feedbackItem} />
            </ErrorBoundary>
            <ErrorBoundary mini>
              <ResolveButton feedbackItem={feedbackItem} />
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
