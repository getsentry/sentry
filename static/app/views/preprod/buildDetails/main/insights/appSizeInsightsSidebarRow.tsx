import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Tag} from 'sentry/components/core/badge/tag';
import {Button} from 'sentry/components/core/button';
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
          <Tag type="success" style={{minWidth: '56px', justifyContent: 'center'}}>
            <Text size="sm" tabular variant="success">
              {formatPercentage(insight.percentage / 100, 1)}
            </Text>
          </Tag>
        </Flex>
      </Flex>

      <Text variant="muted" size="sm">
        {insight.description}
      </Text>

      <Container>
        <Button
          size="sm"
          onClick={onToggleExpanded}
          style={{marginBottom: isExpanded ? '16px' : '0'}}
          icon={
            <IconChevron
              style={{
                transition: 'transform 0.2s ease',
                color: 'inherit',
                transform: isExpanded ? 'rotate(180deg)' : 'rotate(90deg)',
              }}
            />
          }
        >
          <Text variant="primary" size="md" bold>
            {tn('%s file', '%s files', insight.files.length)}
          </Text>
        </Button>

        {isExpanded && (
          <Container
            display="flex"
            css={() => ({
              flexDirection: 'column',
              '& > :nth-child(odd)': {
                backgroundColor: theme.backgroundSecondary,
              },
            })}
          >
            {insight.files.map((file, fileIndex) => (
              <FileRow key={`${file.path}-${fileIndex}`} file={file} />
            ))}
          </Container>
        )}
      </Container>
    </Flex>
  );
}

function FileRow({file}: {file: ProcessedInsightFile}) {
  if (file.data.fileType === 'optimizable_image') {
    return <OptimizableImageFileRow file={file} originalFile={file.data.originalFile} />;
  }

  return (
    <FlexAlternatingRow>
      <Text size="sm" ellipsis style={{flex: 1}}>
        {file.path}
      </Text>
      <Flex align="center" gap="sm">
        <Text variant="primary" bold size="sm" tabular>
          -{formatBytesBase10(file.savings)}
        </Text>
        <Text variant="muted" size="sm" tabular align="right" style={{width: '64px'}}>
          (-{formatPercentage(file.percentage / 100, 1)})
        </Text>
      </Flex>
    </FlexAlternatingRow>
  );
}

function OptimizableImageFileRow({
  file,
  originalFile: _originalFile,
}: {
  file: ProcessedInsightFile;
  originalFile: OptimizableImageFile;
}) {
  return (
    <FlexAlternatingRow>
      <Text size="sm" ellipsis style={{flex: 1}}>
        {file.path}
      </Text>
      <Flex align="center" gap="sm">
        <Text variant="primary" bold size="sm" tabular>
          -{formatBytesBase10(file.savings)}
        </Text>
        <Text variant="muted" size="sm" tabular align="right" style={{width: '64px'}}>
          (-{formatPercentage(file.percentage / 100, 1)})
        </Text>
      </Flex>
    </FlexAlternatingRow>
  );
}

const FlexAlternatingRow = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-radius: ${({theme}) => theme.borderRadius};
  min-width: 0;
  gap: ${({theme}) => theme.space.lg};
  padding: ${({theme}) => theme.space.xs} ${({theme}) => theme.space.sm};
`;
