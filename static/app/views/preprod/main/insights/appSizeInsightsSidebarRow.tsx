import {Container, Flex} from 'sentry/components/core/layout';
import {Text} from 'sentry/components/core/text';
import {formatBytesBase10SavingsAmount} from 'sentry/utils/bytes/formatBytesBase10';
import {
  type FileRowProps,
  FilesToggle,
  SavingsPercentage,
  ToggleIcon,
} from 'sentry/views/preprod/main/insights/appSizeInsightsSidebar';
import type {OptimizableImageFile} from 'sentry/views/preprod/types/appSizeTypes';
import {formatPercentage} from 'sentry/views/preprod/utils/formatters';
import type {
  ProcessedInsight,
  ProcessedInsightFile,
} from 'sentry/views/preprod/utils/insightProcessing';

export function AppSizeInsightsSidebarRow({
  insight,
  isExpanded,
  onToggleExpanded,
}: {
  insight: ProcessedInsight;
  isExpanded: boolean;
  onToggleExpanded: () => void;
}) {
  return (
    <Flex
      background="primary"
      style={{
        border: '1px solid #F0ECF3',
      }}
      radius="md"
      padding="xl"
      direction="column"
      gap="lg"
    >
      <Flex align="start" justify="between">
        <Text variant="primary" size="md" bold>
          {insight.name}
        </Text>
        <Flex
          align="center"
          gap="sm"
          style={{
            flexShrink: 0,
          }}
        >
          <Text size="sm" tabular>
            Potential savings {formatBytesBase10SavingsAmount(insight.totalSavings)}
          </Text>
          <SavingsPercentage>{formatPercentage(-insight.percentage)}</SavingsPercentage>
        </Flex>
      </Flex>

      <Text variant="muted" size="sm" as="p">
        {insight.description}
      </Text>

      <Container>
        <FilesToggle isExpanded={isExpanded} onClick={onToggleExpanded}>
          <ToggleIcon isExpanded={isExpanded} />
          <Text variant="primary" size="md" bold>
            {insight.files.length} files
          </Text>
        </FilesToggle>

        {isExpanded && (
          <Flex direction="column" gap="0">
            {insight.files.map((file, fileIndex) => (
              <FileRow
                key={`${file.path}-${fileIndex}`}
                file={file}
                fileIndex={fileIndex}
              />
            ))}
          </Flex>
        )}
      </Container>
    </Flex>
  );
}

function FileRow({file, fileIndex}: FileRowProps) {
  const isAlternating = fileIndex % 2 === 0;

  if (file.fileType === 'optimizable_image' && file.originalFile) {
    return (
      <OptimizableImageFileRow
        file={file}
        originalFile={file.originalFile as OptimizableImageFile}
        isAlternating={isAlternating}
      />
    );
  }

  return (
    <Flex
      align="center"
      justify="between"
      style={{
        height: '24px',
        padding: '4px 6px',
        borderRadius: '4px',
        background: isAlternating ? '#F7F6F9' : 'transparent',
        borderTop: '1px solid transparent',
        minWidth: 0,
      }}
    >
      <Text
        variant="accent"
        size="sm"
        bold
        ellipsis
        style={{flex: 1, marginRight: '16px', cursor: 'pointer'}}
      >
        {file.path}
      </Text>
      <Flex align="center" gap="sm">
        <Text variant="primary" size="sm" tabular>
          {formatBytesBase10SavingsAmount(-file.savings)}
        </Text>
        <Text
          variant="muted"
          size="sm"
          tabular
          style={{width: '64px', textAlign: 'right'}}
        >
          ({formatPercentage(-file.percentage)})
        </Text>
      </Flex>
    </Flex>
  );
}

function OptimizableImageFileRow({
  file,
  originalFile: _originalFile,
  isAlternating,
}: {
  file: ProcessedInsightFile;
  isAlternating: boolean;
  originalFile: OptimizableImageFile;
}) {
  return (
    <Flex
      align="center"
      justify="between"
      style={{
        height: '24px',
        padding: '4px 6px',
        borderRadius: '4px',
        background: isAlternating ? '#F7F6F9' : 'transparent',
        borderTop: '1px solid transparent',
        minWidth: 0,
      }}
    >
      <Text
        variant="accent"
        size="sm"
        bold
        ellipsis
        style={{flex: 1, marginRight: '16px', cursor: 'pointer'}}
      >
        {file.path}
      </Text>
      <Flex align="center" gap="sm">
        <Text variant="primary" size="sm" tabular>
          {formatBytesBase10SavingsAmount(-file.savings)}
        </Text>
        <Text
          variant="muted"
          size="sm"
          tabular
          style={{width: '64px', textAlign: 'right'}}
        >
          ({formatPercentage(-file.percentage)})
        </Text>
      </Flex>
    </Flex>
  );
}
