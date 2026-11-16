import {useMemo} from 'react';

import {Text} from '@sentry/scraps/text';

import {formatFloat} from 'sentry/utils/number/formatFloat';
import {formatPercentage} from 'sentry/utils/number/formatPercentage';
import {useClassifiedConversations} from 'sentry/views/classifiers/hooks/useClassifiedConversations';
import type {TelemetryClassifier} from 'sentry/views/classifiers/types';
import {
  ConversationsTable,
  type ConversationsTableColumn,
} from 'sentry/views/explore/conversations/components/conversationsTable';

function ClassifierResult({
  outputType,
  value,
}: {
  outputType: TelemetryClassifier['outputType'];
  value: number | null | undefined;
}) {
  if (value === null || value === undefined) {
    return <Text variant="muted">&mdash;</Text>;
  }
  return (
    <Text tabular>
      {outputType === 'binary' ? formatPercentage(value, 0) : formatFloat(value, 2)}
    </Text>
  );
}

interface ClassifiedConversationsTableProps {
  classifier: TelemetryClassifier;
}

export function ClassifiedConversationsTable({
  classifier,
}: ClassifiedConversationsTableProps) {
  const conversations = useClassifiedConversations(classifier);
  const {results} = conversations;
  const projects = useMemo(() => [Number(classifier.projectId)], [classifier.projectId]);

  const additionalColumns = useMemo<ConversationsTableColumn[]>(
    () => [
      {
        key: 'classifierResult',
        name: classifier.resultAttribute,
        width: 160,
        renderBodyCell: conversation => (
          <ClassifierResult
            outputType={classifier.outputType}
            value={results.get(conversation.conversationId)}
          />
        ),
      },
    ],
    [classifier.outputType, classifier.resultAttribute, results]
  );

  return (
    <ConversationsTable
      conversations={conversations}
      additionalColumns={additionalColumns}
      disableCellActions
      persistColumnWidths={false}
      projects={projects}
    />
  );
}
