import {Fragment} from 'react';
import styled from '@emotion/styled';

import Access from 'app/components/acl/access';
import ActionButton from 'app/components/actions/button';
import MenuItemActionLink from 'app/components/actions/menuItemActionLink';
import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import ConfirmDelete from 'app/components/confirmDelete';
import DropdownButton from 'app/components/dropdownButton';
import DropdownLink from 'app/components/dropdownLink';
import Tooltip from 'app/components/tooltip';
import {IconEllipsis} from 'app/icons/iconEllipsis';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {CustomRepoType} from 'app/types/debugFiles';
import TextBlock from 'app/views/settings/components/text/textBlock';

type Props = {
  repositoryName: string;
  repositoryType: string;
  isDetailsExpanded: boolean;
  isDetailsDisabled: boolean;
  onToggleDetails: () => void;
  onEdit: () => void;
  onDelete: () => void;
  showDetails: boolean;
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
      <Access access={['project:write']}>
        {({hasAccess}) => (
          <Fragment>
            <ButtonTooltip
              title={t(
                'You do not have permission to edit custom repository configurations.'
              )}
              disabled={hasAccess}
            >
              <ActionBtn
                disabled={!hasAccess || isDetailsDisabled}
                onClick={onEdit}
                size="small"
              >
                {t('Configure')}
              </ActionBtn>
            </ButtonTooltip>

            {!hasAccess || isDetailsDisabled ? (
              <ButtonTooltip
                title={t(
                  'You do not have permission to delete custom repository configurations.'
                )}
                disabled={hasAccess}
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
                customTitle={
                  <StyledActionButton
                    label={t('Actions')}
                    disabled={!hasAccess || isDetailsDisabled}
                    title={
                      !hasAccess
                        ? t(
                            'You do not have permission to edit and delete custom repository configurations.'
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
                  <MenuItemActionLink title={t('Delete')}>
                    {t('Delete')}
                  </MenuItemActionLink>
                )}
              </DropdownLink>
            </DropDownWrapper>
          </Fragment>
        )}
      </Access>
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
    grid-gap: ${space(1)};
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
