import {Button} from '@sentry/scraps/button';

import {IconDelete} from 'sentry/icons';
import {t} from 'sentry/locale';

const CODE_OWNER_DELETE_TOOLTIP = t(
  'Remove the Code Owners connection before deleting this mapping.'
);

export function PathMappingDeleteButton({
  hasCodeOwner,
  onDelete,
}: {
  onDelete: () => void;
  hasCodeOwner?: boolean;
}) {
  return (
    <Button
      size="zero"
      variant="transparent"
      icon={<IconDelete />}
      aria-label={t('Delete path mapping')}
      disabled={hasCodeOwner}
      tooltipProps={hasCodeOwner ? {title: CODE_OWNER_DELETE_TOOLTIP} : undefined}
      onClick={onDelete}
    />
  );
}
