import {Button} from '@sentry/scraps/button';
import {InfoText} from '@sentry/scraps/info';
import {Container, Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {IconArrow, IconBranch, IconChevron, IconDelete} from 'sentry/icons';
import {t} from 'sentry/locale';

import {AccentPathSegment} from './accentPathSegment';
import {normalizedPathMappingSchema} from './normalization';
import type {PathMappingValue} from './type';

const PATH_RATIO = 35;
const BRANCH_RATIO = 30;

interface PathMappingSummaryProps extends PathMappingValue {
  expanded: boolean;
  onDelete: () => void;
  onExpandToggle: () => void;
}

function PathSegment({value}: {value: string}) {
  return (
    <Flex flex={`${PATH_RATIO} 0 0%`} minWidth={0} maxWidth="max-content">
      {value ? (
        <AccentPathSegment value={value} ellipsis />
      ) : (
        <Text monospace variant="muted">
          {t('empty')}
        </Text>
      )}
    </Flex>
  );
}

export function PathMappingSummary({
  branch,
  sourceRoot,
  stackRoot,
  expanded,
  onDelete,
  onExpandToggle,
}: PathMappingSummaryProps) {
  const {
    stackRoot: normalizedStackRoot,
    sourceRoot: normalizedSourceRoot,
    branch: branchName,
  } = normalizedPathMappingSchema.parse({stackRoot, sourceRoot, branch});

  return (
    <Container padding="md xl">
      <Flex align="center" gap="md" minWidth={0}>
        <PathSegment value={normalizedStackRoot} />
        <Container flexShrink={0}>
          {props => <IconArrow direction="right" size="xs" {...props} />}
        </Container>
        <PathSegment value={normalizedSourceRoot} />

        <Container flex="1 0 0%" />

        <Flex
          align="center"
          gap="xs"
          flex={`${BRANCH_RATIO} 0 0%`}
          minWidth={0}
          maxWidth="max-content"
        >
          <Container flexShrink={0}>{props => <IconBranch {...props} />}</Container>
          <InfoText title={branchName} mode="overflowOnly" variant="muted">
            {branchName}
          </InfoText>
        </Flex>

        <Flex align="center" gap="xs" flexShrink={0}>
          <Button
            size="zero"
            variant="transparent"
            icon={<IconChevron direction={expanded ? 'up' : 'down'} />}
            aria-label={expanded ? t('Collapse path mapping') : t('Expand path mapping')}
            onClick={onExpandToggle}
          />
          <Button
            size="zero"
            variant="transparent"
            icon={<IconDelete />}
            aria-label={t('Delete path mapping')}
            onClick={onDelete}
          />
        </Flex>
      </Flex>
    </Container>
  );
}
