import {Fragment} from 'react';

import {Button} from 'sentry/components/button';
import {openConfirmModal} from 'sentry/components/confirm';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {IconEllipsis} from 'sentry/icons/iconEllipsis';
import {t} from 'sentry/locale';
import TextBlock from 'sentry/views/settings/components/text/textBlock';

type Props = {
  hasAccess: boolean;
  hasFeature: boolean;
  onDelete: () => void;
  onEdit: () => void;
  repositoryName: string;
};

function Actions({repositoryName, onEdit, onDelete, hasFeature, hasAccess}: Props) {
  const actionsDisabled = !hasAccess || !hasFeature;

  return (
    <DropdownMenu
      isDisabled={actionsDisabled}
      trigger={triggerProps => (
        <Button
          size="xs"
          aria-label={t('Actions')}
          disabled={actionsDisabled}
          title={
            !hasFeature
              ? undefined
              : !hasAccess
                ? t(
                    'You do not have permission to edit and delete custom repositories configurations.'
                  )
                : undefined
          }
          icon={<IconEllipsis />}
          {...triggerProps}
        />
      )}
      position="bottom-end"
      items={[
        {
          key: 'configure',
          label: t('Configure'),
          onAction: onEdit,
        },
        {
          key: 'delete',
          label: t('Delete'),
          onAction: () => {
            openConfirmModal({
              header: <h6>{t('Delete %s?', repositoryName)}</h6>,
              message: (
                <Fragment>
                  <TextBlock>
                    <strong>
                      {t('Removing this repository applies instantly to new events.')}
                    </strong>
                  </TextBlock>
                  <TextBlock>
                    {t(
                      'Debug files from this repository will not be used to symbolicate future events. This may create new issues and alert members in your organization.'
                    )}
                  </TextBlock>
                </Fragment>
              ),
              onConfirm: onDelete,
            });
          },
        },
      ]}
    />
  );
}

export default Actions;
