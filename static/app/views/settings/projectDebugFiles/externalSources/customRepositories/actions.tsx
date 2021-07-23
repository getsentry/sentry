import {Fragment} from 'react';
import styled from '@emotion/styled';

import ActionButton from 'app/components/actions/button';
import MenuItemActionLink from 'app/components/actions/menuItemActionLink';
import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import ConfirmDelete from 'app/components/confirmDelete';
import DropdownButton from 'app/components/dropdownButton';
import DropdownLink from 'app/components/dropdownLink';
import {IconEllipsis} from 'app/icons/iconEllipsis';
import {t} from 'app/locale';
import space from 'app/styles/space';
import TextBlock from 'app/views/settings/components/text/textBlock';

type Props = {
  repositoryName: string;
  isDetailsExpanded: boolean;
  isDetailsDisabled: boolean;
  onToggleDetails: () => void;
  onEdit: () => void;
  onDelete: () => void;
  showDetails: boolean;
};

function Actions({
  repositoryName,
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
          onClick={onToggleDetails}
          hideBottomBorder={false}
          disabled={isDetailsDisabled}
        >
          {t('Details')}
        </StyledDropdownButton>
      )}
      <StyledButton onClick={onEdit} size="small">
        {t('Configure')}
      </StyledButton>
      {renderConfirmDelete(<StyledButton size="small">{t('Delete')}</StyledButton>)}
      <DropDownWrapper>
        <DropdownLink
          caret={false}
          customTitle={
            <StyledActionButton label={t('Actions')} icon={<IconEllipsis />} />
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
    grid-gap: ${space(1)};
    margin-top: ${space(0.5)};
  }
`;

const StyledButton = styled(Button)`
  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    display: none;
  }
`;

const DropDownWrapper = styled('div')`
  @media (max-width: ${p => p.theme.breakpoints[0]}) {
    display: none;
  }
`;
