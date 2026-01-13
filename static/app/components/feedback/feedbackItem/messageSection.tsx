import styled from '@emotion/styled';

import {useRole} from 'sentry/components/acl/useRole';
import {ScreenshotSection} from 'sentry/components/feedback/feedbackItem/screenshotSection';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types/event';
import type {FeedbackIssue} from 'sentry/utils/feedback/types';
import useOrganization from 'sentry/utils/useOrganization';

interface Props {
  eventData: Event | undefined;
  feedbackItem: FeedbackIssue;
}

export default function MessageSection({eventData, feedbackItem}: Props) {
  const organization = useOrganization();
  const {hasRole} = useRole({role: 'attachmentsRole'});
  const project = feedbackItem.project;

  return (
    <Blockquote>
      <pre>{feedbackItem.metadata.message}</pre>

      {eventData && project && hasRole ? (
        <ScreenshotSection
          event={eventData}
          organization={organization}
          projectSlug={project.slug}
        />
      ) : null}
    </Blockquote>
  );
}

const Blockquote = styled('blockquote')`
  margin: 0;
  background: ${p => p.theme.tokens.background.transparent.accent.muted};

  display: flex;
  flex-direction: column;
  gap: ${space(2)};

  border-left: 2px solid ${p => p.theme.tokens.graphics.accent.vibrant};
  padding: ${space(2)};

  & > pre {
    margin-bottom: 0;
    background: none;
    font-family: inherit;
    font-size: ${p => p.theme.fontSize.md};
    line-height: 1.6;
    padding: 0;
    word-break: break-word;
    color: ${p => p.theme.tokens.content.primary};
  }
`;
