import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';

interface ExpandAllButtonProps {
  isExpanded: boolean;
  isLoadingAll: boolean;
  isPartial: boolean;
  onCancel: () => void;
  onCollapse: () => void;
  onExpand: () => void;
}

export function ExpandAllButton({
  isExpanded,
  isLoadingAll,
  isPartial,
  onCancel,
  onCollapse,
  onExpand,
}: ExpandAllButtonProps) {
  if (isLoadingAll) {
    return (
      <Flex align="center" gap="sm">
        <Text size="sm" variant="muted">
          {t('Loading spans…')}
        </Text>
        <Button size="xs" onClick={onCancel}>
          {t('Cancel')}
        </Button>
      </Flex>
    );
  }

  if (isExpanded) {
    return (
      <Flex align="center" gap="sm">
        {isPartial ? (
          <Text size="sm" variant="muted">
            {t('Only the first 10,000 spans are loaded')}
          </Text>
        ) : null}
        <Button size="xs" onClick={onCollapse}>
          {t('Collapse all')}
        </Button>
      </Flex>
    );
  }

  return (
    <Button size="xs" onClick={onExpand}>
      {t('Expand all')}
    </Button>
  );
}
