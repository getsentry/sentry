import {Fragment} from 'react';
import styled from '@emotion/styled';

import ActionButton from 'sentry/components/actions/button';
import MenuItemActionLink from 'sentry/components/actions/menuItemActionLink';
import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import ConfirmDelete from 'sentry/components/confirmDelete';
import DropdownLink from 'sentry/components/dropdownLink';
import {Tooltip} from 'sentry/components/tooltip';
import {IconEllipsis} from 'sentry/icons/iconEllipsis';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {CustomRepoType} from 'sentry/types/debugFiles';
import TextBlock from 'sentry/views/settings/components/text/textBlock';

type Props = {
  hasAccess: boolean;
  hasFeature: boolean;
  onDelete: () => void;
  onEdit: () => void;
  repositoryName: string;
  repositoryType: string;
  disabled?: boolean;
  syncNowButton?: React.ReactElement;
};

function Actions({
  repositoryName,
  repositoryType,
  disabled,
  onEdit,
  onDelete,
  hasFeature,
  hasAccess,
  syncNowButton,
}: Props) {
  function renderConfirmDelete(element: React.ReactElement) {
    return (
      <ConfirmDelete
        confirmText={t('Delete Repository')}
        message={
          repositoryType === CustomRepoType.APP_STORE_CONNECT ? (
            <Fragment>
              <TextBlock>
                <strong>
                  {t(
                    'Removing App Store Connect symbol source does not remove current dSYMs.'
                  )}
                </strong>
              </TextBlock>
              <TextBlock>
                {t(
                  'The App Store Connect symbol source periodically imports dSYMs into the "Uploaded debug information files". Removing this symbol source does not delete those files and they will remain available for symbolication until deleted directly.'
                )}
              </TextBlock>
            </Fragment>
          ) : (
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
          )
        }
        confirmInput={repositoryName}
        priority="danger"
        onConfirm={onDelete}
      >
        {element}
      </ConfirmDelete>
    );
  }

  const actionsDisabled = !hasAccess || !hasFeature || disabled;

  return (
    <StyledButtonBar gap={1}>
      {syncNowButton}
      <ButtonTooltip
        title={
          !hasFeature
            ? undefined
            : !hasAccess
            ? t('You do not have permission to edit custom repositories configurations.')
            : undefined
        }
        disabled={actionsDisabled}
      >
        <ActionBtn disabled={actionsDisabled} onClick={onEdit} size="sm">
          {t('Configure')}
        </ActionBtn>
      </ButtonTooltip>

      {actionsDisabled ? (
        <ButtonTooltip
          title={
            !hasFeature
              ? undefined
              : !hasAccess
              ? t(
                  'You do not have permission to delete custom repositories configurations.'
                )
              : undefined
          }
          disabled={actionsDisabled}
        >
          <ActionBtn size="sm" disabled>
            {t('Delete')}
          </ActionBtn>
        </ButtonTooltip>
      ) : (
        renderConfirmDelete(<ActionBtn size="sm">{t('Delete')}</ActionBtn>)
      )}
      <DropDownWrapper>
        <DropdownLink
          caret={false}
          disabled={actionsDisabled}
          customTitle={
            <StyledActionButton
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
            />
          }
          anchorRight
        >
          <MenuItemActionLink onClick={onEdit}>{t('Configure')}</MenuItemActionLink>
          {renderConfirmDelete(<MenuItemActionLink>{t('Delete')}</MenuItemActionLink>)}
        </DropdownLink>
      </DropDownWrapper>
    </StyledButtonBar>
  );
}

export default Actions;

const StyledActionButton = styled(ActionButton)`
  height: 32px;
`;

const StyledButtonBar = styled(ButtonBar)`
  gap: ${space(1)};

  grid-column: 2/2;
  grid-row: 4/4;
  grid-auto-flow: row;
  margin-top: ${space(0.5)};

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    grid-column: 3/3;
    grid-row: 1/3;
    grid-auto-flow: column;
    margin-top: 0;
  }
`;

const ButtonTooltip = styled(Tooltip)`
  @media (min-width: ${p => p.theme.breakpoints.small}) {
    display: none;
  }
`;

const ActionBtn = styled(Button)`
  width: 100%;
  @media (min-width: ${p => p.theme.breakpoints.small}) {
    display: none;
  }
`;

const DropDownWrapper = styled('div')`
  display: none;
  @media (min-width: ${p => p.theme.breakpoints.small}) {
    display: block;
  }
`;
