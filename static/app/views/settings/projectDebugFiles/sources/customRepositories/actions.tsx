import {Fragment} from 'react';
import styled from '@emotion/styled';

import ActionButton from 'sentry/components/actions/button';
import MenuItemActionLink from 'sentry/components/actions/menuItemActionLink';
import Button from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import ConfirmDelete from 'sentry/components/confirmDelete';
import DropdownButton from 'sentry/components/dropdownButton';
import DropdownLink from 'sentry/components/dropdownLink';
import Tooltip from 'sentry/components/tooltip';
import {IconEllipsis} from 'sentry/icons/iconEllipsis';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {CustomRepoType} from 'sentry/types/debugFiles';
import TextBlock from 'sentry/views/settings/components/text/textBlock';

type Props = {
  repositoryName: string;
  repositoryType: string;
  isDetailsExpanded: boolean;
  isDetailsDisabled: boolean;
  onToggleDetails: () => void;
  onEdit: () => void;
  onDelete: () => void;
  showDetails: boolean;
  hasFeature: boolean;
  hasAccess: boolean;
};

function Actions({
  repositoryName,
  repositoryType,
  isDetailsExpanded,
  isDetailsDisabled,
  onToggleDetails,
  onEdit,
  onDelete,
  showDetails,
  hasFeature,
  hasAccess,
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

  const actionsDisabled = !hasAccess || isDetailsDisabled || !hasFeature;

  return (
    <StyledButtonBar gap={1}>
      {showDetails && (
        <StyledDropdownButton
          isOpen={isDetailsExpanded}
          size="small"
          onClick={isDetailsDisabled ? undefined : onToggleDetails}
          hideBottomBorder={false}
          disabled={isDetailsDisabled}
        >
          {t('Details')}
        </StyledDropdownButton>
      )}

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
        <ActionBtn disabled={actionsDisabled} onClick={onEdit} size="small">
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
          <ActionBtn size="small" disabled>
            {t('Delete')}
          </ActionBtn>
        </ButtonTooltip>
      ) : (
        renderConfirmDelete(<ActionBtn size="small">{t('Delete')}</ActionBtn>)
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
          <MenuItemActionLink title={t('Configure')} onClick={onEdit}>
            {t('Configure')}
          </MenuItemActionLink>
          {renderConfirmDelete(
            <MenuItemActionLink title={t('Delete')}>{t('Delete')}</MenuItemActionLink>
          )}
        </DropdownLink>
      </DropDownWrapper>
    </StyledButtonBar>
  );
}

export default Actions;

const StyledActionButton = styled(ActionButton)`
  height: 32px;
`;

const StyledDropdownButton = styled(DropdownButton)`
  border-bottom-right-radius: ${p => p.theme.borderRadius};
  border-bottom-left-radius: ${p => p.theme.borderRadius};
`;

const StyledButtonBar = styled(ButtonBar)`
  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    grid-row: 1 / 3;
  }

  @media (max-width: ${p => p.theme.breakpoints[0]}) {
    grid-auto-flow: row;
    gap: ${space(1)};
    margin-top: ${space(0.5)};
  }
`;

const ButtonTooltip = styled(Tooltip)`
  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    display: none;
  }
`;

const ActionBtn = styled(Button)`
  width: 100%;
  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    display: none;
  }
`;

const DropDownWrapper = styled('div')`
  @media (max-width: ${p => p.theme.breakpoints[0]}) {
    display: none;
  }
`;
