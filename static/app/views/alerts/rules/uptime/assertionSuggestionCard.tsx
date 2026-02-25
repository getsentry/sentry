import {Badge} from '@sentry/scraps/badge';
import {Button} from '@sentry/scraps/button';
import {Flex, Stack, Surface} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import Placeholder from 'sentry/components/placeholder';
import {t, tct} from 'sentry/locale';
import {
  AssertionType,
  ComparisonType,
  type AssertionSuggestion,
} from 'sentry/views/alerts/rules/uptime/types';

function getConfidenceBadgeVariant(confidence: number): 'success' | 'warning' | 'danger' {
  if (confidence >= 0.8) {
    return 'success';
  }
  if (confidence >= 0.5) {
    return 'warning';
  }
  return 'danger';
}

interface AssertionSuggestionCardProps {
  onApply: () => void;
  suggestion: AssertionSuggestion;
}

export function AssertionSuggestionCard({
  suggestion,
  onApply,
}: AssertionSuggestionCardProps) {
  const getAssertionLabel = () => {
    switch (suggestion.assertion_type) {
      case AssertionType.STATUS_CODE:
        return tct('Status code [comparison] [value]', {
          comparison: suggestion.comparison.replace('_', ' '),
          value: suggestion.expected_value,
        });
      case AssertionType.JSON_PATH:
        if (suggestion.comparison === ComparisonType.ALWAYS) {
          return tct('[path] exists', {
            path: suggestion.json_path,
          });
        }
        return tct('[path] [comparison] [value]', {
          path: suggestion.json_path,
          comparison: suggestion.comparison.replace('_', ' '),
          value: `"${suggestion.expected_value}"`,
        });
      case AssertionType.HEADER:
        if (suggestion.comparison === ComparisonType.ALWAYS) {
          return tct('Header [name] exists', {
            name: suggestion.header_name,
          });
        }
        return tct('Header [name] [comparison] [value]', {
          name: suggestion.header_name,
          comparison: suggestion.comparison.replace('_', ' '),
          value: `"${suggestion.expected_value}"`,
        });
      default:
        return t('Unknown assertion type');
    }
  };

  const confidencePercent = Math.round(suggestion.confidence * 100);

  return (
    <Surface variant="overlay" elevation="medium" padding="md" minHeight="74px">
      <Flex gap="md" justify="between" height="100%">
        <Stack gap="sm" flex={1} minWidth={0} justify="around">
          <Text bold>{getAssertionLabel()}</Text>
          <Text size="sm">{suggestion.explanation}</Text>
        </Stack>
        <Stack gap="sm" align="end" flexShrink={0} justify="between">
          <Tooltip
            title={t('Likelihood this assertion remains stable across repeated checks.')}
          >
            <Badge
              variant={getConfidenceBadgeVariant(suggestion.confidence)}
              style={{whiteSpace: 'nowrap'}}
            >
              {tct('[percent]% confidence', {percent: confidencePercent})}
            </Badge>
          </Tooltip>
          <Flex flexGrow={1} align="center">
            <Button size="xs" onClick={onApply}>
              {t('Apply')}
            </Button>
          </Flex>
        </Stack>
      </Flex>
    </Surface>
  );
}

export function AssertionSuggestionCardPlaceholder() {
  return (
    <Stack gap="md">
      {Array.from({length: 6}).map((_, i) => (
        <Placeholder key={i} height="74px" />
      ))}
    </Stack>
  );
}
