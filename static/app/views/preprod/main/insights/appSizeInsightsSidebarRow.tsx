import styled from '@emotion/styled';

import {Container, Flex} from 'sentry/components/core/layout';
import {Text} from 'sentry/components/core/text';
import {IconChevron} from 'sentry/icons/iconChevron';
import {formatBytesBase10SavingsAmount} from 'sentry/utils/bytes/formatBytesBase10';
import {type FileRowProps} from 'sentry/views/preprod/main/insights/appSizeInsightsSidebar';
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
    <Flex border="muted" radius="md" padding="xl" direction="column" gap="lg">
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
          <SavingsPercentage align="center" justify="center">
            <Text size="xs" variant="success" tabular>
              {formatPercentage(-insight.percentage)}
            </Text>
          </SavingsPercentage>
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
      radius="md"
      height="24px"
      minWidth={0}
      gap="lg"
      style={{
        padding: '4px 6px',
        background: isAlternating ? '#F7F6F9' : 'transparent',
      }}
    >
      <Text variant="accent" size="sm" bold ellipsis style={{flex: 1}}>
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
      gap="lg"
      radius="md"
      minWidth={0}
      height="24px"
      style={{
        padding: '4px 6px',
        background: isAlternating ? '#F7F6F9' : 'transparent',
      }}
    >
      <Text variant="accent" size="sm" bold ellipsis style={{flex: 1}}>
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

const SavingsPercentage = styled(Flex)`
  min-width: 56px;
  height: 20px;
  padding: 2px 6px;
  border-radius: 4px;
  background: ${p => p.theme.green100};
  flex-shrink: 0;
`;

const FilesToggle = styled('button')<{isExpanded: boolean}>`
  display: flex;
  align-items: center;
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  font-size: 14px;
  color: ${p => p.theme.textColor};
  margin-bottom: ${p => (p.isExpanded ? p.theme.space.md : '0')};

  &:hover {
    color: ${p => p.theme.blue400};
  }
`;

const ToggleIcon = styled(IconChevron)<{isExpanded: boolean}>`
  margin-right: ${p => p.theme.space.xs};
  transform: ${p => (p.isExpanded ? 'rotate(180deg)' : 'rotate(90deg)')};
  transition: transform 0.2s ease;
  color: inherit;
`;
