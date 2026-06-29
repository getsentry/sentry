import {Fragment} from 'react';

import {Tag} from '@sentry/scraps/badge';
import {Flex, Grid} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {Count} from 'sentry/components/count';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {t, tn} from 'sentry/locale';
import {getDuration} from 'sentry/utils/duration/getDuration';
import type {ConversationToolUsage} from 'sentry/views/explore/conversations/hooks/useConversationToolBreakdown';

interface ConversationToolCallsBreakdownProps {
  data: ConversationToolUsage[];
  error: unknown;
  isLoading: boolean;
}

export function ConversationToolCallsBreakdown({
  data,
  error,
  isLoading,
}: ConversationToolCallsBreakdownProps) {
  if (isLoading) {
    return (
      <Flex justify="center">
        <LoadingIndicator size={24} style={{margin: 0}} />
      </Flex>
    );
  }

  if (error) {
    return <Text>{t('Failed to load tool calls')}</Text>;
  }

  if (data.length === 0) {
    return <Text>{t('No tool calls')}</Text>;
  }

  return (
    <Grid columns="1fr max-content max-content" gap="md xl" align="center">
      {data.map(tool => (
        <Fragment key={tool.toolName}>
          <Tag
            variant={tool.hasError ? 'danger' : 'muted'}
            title={tool.toolName}
            // Cap long tool names; the inner Text truncates with an ellipsis.
            style={{justifySelf: 'start', maxWidth: 200, minWidth: 0}}
          >
            <Text ellipsis variant="inherit">
              {tool.toolName}
            </Text>
          </Tag>
          <Text size="sm" tabular>
            <Count value={tool.calls} /> {tn('call', 'calls', tool.calls)}
          </Text>
          <Text size="sm" align="right" tabular>
            {getDuration(tool.duration / 1000, 1, true)}
          </Text>
        </Fragment>
      ))}
    </Grid>
  );
}
