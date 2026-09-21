import type {ButtonProps} from '@sentry/scraps/button';
import {Button} from '@sentry/scraps/button';

import {Access} from 'sentry/components/acl/access';
import {Confirm} from 'sentry/components/confirm';
import {IconDelete} from 'sentry/icons';
import {t} from 'sentry/locale';

interface DebugIdBundleDeleteButtonProps {
  onDelete: () => void;
  size?: ButtonProps['size'];
}

export function DebugIdBundleDeleteButton({
  onDelete,
  size = 'xs',
}: DebugIdBundleDeleteButtonProps) {
  return (
    <Access access={['project:releases']}>
      {({hasAccess}) => (
        <Confirm
          onConfirm={onDelete}
          message={t('Are you sure you want to delete these source maps?')}
          disabled={!hasAccess}
        >
          <Button
            icon={<IconDelete size="xs" />}
            size={size}
            disabled={!hasAccess}
            tooltipProps={{
              title: t('You do not have permission to delete source maps.'),
            }}
          >
            {t('Delete Source Maps')}
          </Button>
        </Confirm>
      )}
    </Access>
  );
}
