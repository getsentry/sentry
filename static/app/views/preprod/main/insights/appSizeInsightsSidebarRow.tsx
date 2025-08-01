import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Container, Flex} from 'sentry/components/core/layout';
import {Text} from 'sentry/components/core/text';
import {IconChevron} from 'sentry/icons/iconChevron';
import {t, tn} from 'sentry/locale';
import {formatBytesBase10} from 'sentry/utils/bytes/formatBytesBase10';
import {formatPercentage} from 'sentry/utils/number/formatPercentage';
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
  const theme = useTheme();
  return (
    <Flex border="muted" radius="md" padding="xl" direction="column" gap="md">
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
            {t('Potential savings %s', formatBytesBase10(insight.totalSavings))}
          </Text>
          <Flex
            align="center"
            justify="center"
            padding="2xs"
            radius="sm"
            height="20px"
            minWidth="56px"
            style={{
              flexShrink: 0,
              background: theme.green100,
            }}
          >
            <Text size="xs" variant="success" tabular>
              {formatPercentage(insight.percentage / 100, 1)}
            </Text>
          </Flex>
        </Flex>
      </Flex>

      <Text variant="muted" size="sm">
        {insight.description}
      </Text>

      <Container>
        <FilesToggleButton
          onClick={onToggleExpanded}
          style={{marginBottom: isExpanded ? '16px' : '0'}}
        >
          <ToggleIcon
            style={{transform: isExpanded ? 'rotate(180deg)' : 'rotate(90deg)'}}
          />
          <Text variant="primary" size="md" bold>
            {tn('%s file', '%s files', insight.files.length)}
          </Text>
        </FilesToggleButton>

        {isExpanded && (
          <Flex direction="column">
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

function FileRow({file, fileIndex}: {file: ProcessedInsightFile; fileIndex: number}) {
  const isAlternating = fileIndex % 2 === 0;
  const theme = useTheme();

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
        backgroundColor: isAlternating ? theme.surface200 : 'transparent',
        padding: '4px 6px',
      }}
    >
      <Text variant="accent" size="sm" bold ellipsis style={{flex: 1}}>
        {file.path}
      </Text>
      <Flex align="center" gap="sm">
        <Text variant="primary" size="sm" tabular>
          -{formatBytesBase10(file.savings)}
        </Text>
        <Text variant="muted" size="sm" tabular align="right" style={{width: '64px'}}>
          (-{formatPercentage(file.percentage / 100, 1)})
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
  const theme = useTheme();
  return (
    <Flex
      align="center"
      justify="between"
      gap="lg"
      radius="md"
      minWidth={0}
      style={{
        backgroundColor: isAlternating ? theme.surface200 : 'transparent',
        padding: '4px 6px',
      }}
    >
      <Text variant="accent" size="sm" bold ellipsis style={{flex: 1}}>
        {file.path}
      </Text>
      <Flex align="center" gap="sm">
        <Text variant="primary" size="sm" tabular>
          -{formatBytesBase10(file.savings)}
        </Text>
        <Text variant="muted" size="sm" tabular align="right" style={{width: '64px'}}>
          (-{formatPercentage(file.percentage / 100, 1)})
        </Text>
      </Flex>
    </Flex>
  );
}

const FilesToggleButton = styled('button')`
  display: flex;
  align-items: center;
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  gap: ${p => p.theme.space.xs};
  color: ${p => p.theme.textColor};
  line-height: 1;
  &:hover {
    color: ${p => p.theme.blue400};
  }
`;

const ToggleIcon = styled(IconChevron)`
  transition: transform 0.2s ease;
  color: inherit;
`;
