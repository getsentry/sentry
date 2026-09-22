import styled from '@emotion/styled';

import {Stack} from '@sentry/scraps/layout';
import {Heading} from '@sentry/scraps/text';

import {Placeholder} from 'sentry/components/placeholder';
import {t} from 'sentry/locale';

type InvestigationCellPlaceholderProps = {
  className?: string;
  title?: string | null;
};

/** What a notebook cell looks like while Seer is still writing it. */
export function InvestigationCellPlaceholder({
  className,
  title,
}: InvestigationCellPlaceholderProps) {
  return (
    <Stack
      className={className}
      gap="md"
      width="100%"
      minWidth={0}
      role="status"
      aria-label={title ? t('Loading %s', title) : t('Loading cell')}
      data-test-id="investigation-cell-placeholder"
    >
      {title ? (
        <Heading as="h3" size="lg">
          {title}
        </Heading>
      ) : (
        <PlaceholderLine
          height="20px"
          width="40%"
          testId="investigation-cell-placeholder-title"
        />
      )}
      <Stack gap="sm" width="100%">
        <PlaceholderLine height="12px" />
        <PlaceholderLine height="12px" />
        <PlaceholderLine height="12px" width="65%" />
      </Stack>
    </Stack>
  );
}

const PlaceholderLine = styled(Placeholder)`
  border-radius: ${p => p.theme.radius.sm};
`;
