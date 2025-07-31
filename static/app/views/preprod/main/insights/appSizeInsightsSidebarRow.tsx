import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import {Container, Flex} from 'sentry/components/core/layout';
import {Text} from 'sentry/components/core/text';
import {IconChevron} from 'sentry/icons/iconChevron';
import {formatBytesBase10} from 'sentry/utils/bytes/formatBytesBase10';
import {formatPercentage} from 'sentry/utils/number/formatPercentage';
import {type FileRowProps} from 'sentry/views/preprod/main/insights/appSizeInsightsSidebar';
import type {OptimizableImageFile} from 'sentry/views/preprod/types/appSizeTypes';
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
            Potential savings {formatBytesBase10(insight.totalSavings)}
          </Text>
          <SavingsPercentage
            align="center"
            justify="center"
            padding="2xs"
            radius="sm"
            height="20px"
            minWidth="56px"
            style={{
              flexShrink: 0,
            }}
          >
            <Text size="xs" variant="success" tabular>
              {formatPercentage(insight.percentage / 100, 1)}
            </Text>
          </SavingsPercentage>
        </Flex>
      </Flex>

      <Text variant="muted" size="sm" as="p">
        {insight.description}
      </Text>

      <Container>
        <FilesToggle
          priority="link"
          borderless
          size="md"
          icon={<ToggleIcon isExpanded={isExpanded} />}
          onClick={onToggleExpanded}
          style={{marginBottom: isExpanded ? '16px' : '0'}}
        >
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
    <FileRowContainer
      align="center"
      justify="between"
      radius="md"
      minWidth={0}
      gap="lg"
      isAlternating={isAlternating}
    >
      <Text variant="accent" size="sm" bold ellipsis style={{flex: 1}}>
        {file.path}
      </Text>
      <Flex align="center" gap="sm">
        <Text variant="primary" size="sm" tabular>
          -{formatBytesBase10(file.savings)}
        </Text>
        <Text
          variant="muted"
          size="sm"
          tabular
          style={{width: '64px', textAlign: 'right'}}
        >
          (-{formatPercentage(file.percentage / 100, 1)})
        </Text>
      </Flex>
    </FileRowContainer>
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
    <FileRowContainer
      align="center"
      justify="between"
      gap="lg"
      radius="md"
      minWidth={0}
      isAlternating={isAlternating}
    >
      <Text variant="accent" size="sm" bold ellipsis style={{flex: 1}}>
        {file.path}
      </Text>
      <Flex align="center" gap="sm">
        <Text variant="primary" size="sm" tabular>
          -{formatBytesBase10(file.savings)}
        </Text>
        <Text
          variant="muted"
          size="sm"
          tabular
          style={{width: '64px', textAlign: 'right'}}
        >
          (-{formatPercentage(file.percentage / 100, 1)})
        </Text>
      </Flex>
    </FileRowContainer>
  );
}

const SavingsPercentage = styled(Flex)`
  background: ${p => p.theme.green100};
`;

const FilesToggle = styled(Button)`
  padding: 0;
  font-weight: ${p => p.theme.fontWeight.normal};
`;

const ToggleIcon = styled(IconChevron)<{isExpanded: boolean}>`
  transform: ${p => (p.isExpanded ? 'rotate(180deg)' : 'rotate(90deg)')};
  transition: transform 0.2s ease;
  color: inherit;
`;

const FileRowContainer = styled(Flex)<{isAlternating: boolean}>`
  height: 24px;
  padding: 4px 6px;
  background: ${p => (p.isAlternating ? p.theme.surface200 : 'transparent')};
`;
