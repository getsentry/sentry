import styled from '@emotion/styled';

import {ContextSummaryGeneric} from 'sentry/components/events/contextSummary/contextSummaryGeneric';
import {ContextSummaryOS} from 'sentry/components/events/contextSummary/contextSummaryOS';
import QuestionTooltip from 'sentry/components/questionTooltip';
import * as SidebarSection from 'sentry/components/sidebarSection';
import {t} from 'sentry/locale';
import type {HydratedFeedbackItem} from 'sentry/utils/feedback/types';

interface Props {
  feedback: HydratedFeedbackItem;
}

export default function FeedbackTags({feedback}: Props) {
  return (
    <SidebarSection.Wrap>
      <SidebarSection.Title>
        {t('Tags')}
        <QuestionTooltip
          size="xs"
          position="top"
          title={t('The default and custom tags associated with this feedback')}
        />
      </SidebarSection.Title>
      <SidebarSection.Content>
        <Flex>
          <ContextSummaryOS
            data={{
              name: feedback.os?.name ?? '',
              version: feedback.os?.version ?? '',
            }}
            meta={{}}
          />
          <ContextSummaryGeneric
            data={{
              name: feedback.browser?.name ?? '',
              version: feedback.browser?.version ?? '',
            }}
            meta={{}}
          />
        </Flex>
      </SidebarSection.Content>
    </SidebarSection.Wrap>
  );
}

const Flex = styled('div')`
  display: flex;
`;
