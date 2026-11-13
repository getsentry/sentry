import {IconDelete} from '@sentry/icons/delete';

import {Button} from '@sentry/scraps/button';

import {t} from 'sentry/locale';

import {CodeOwnerMessage} from './codeOwnerMessage';

export function PathMappingDeleteButton({
  hasCodeOwner,
  onDelete,
  projectSlug,
}: {
  onDelete: () => void;
  hasCodeOwner?: boolean;
  projectSlug?: string;
}) {
  return (
    <Button
      size="zero"
      variant="transparent"
      icon={<IconDelete />}
      aria-label={t('Remove code mapping')}
      disabled={hasCodeOwner}
      tooltipProps={{
        title: hasCodeOwner ? (
          <CodeOwnerMessage projectSlug={projectSlug} />
        ) : (
          t('Remove code mapping')
        ),
      }}
      onClick={onDelete}
    />
  );
}
