import styled from '@emotion/styled';

import SidebarPanelActions from 'app/actions/sidebarPanelActions';
import Alert from 'app/components/alert';
import Button from 'app/components/button';
import {SidebarPanelKey} from 'app/components/sidebar/types';
import {IconUpgrade} from 'app/icons';
import {t} from 'app/locale';
import {SdkSuggestionType} from 'app/types';

const actionDescription = {
  [SdkSuggestionType.UPDATE_SDK]: t('Update SDK'),
  [SdkSuggestionType.CHANGE_SDK]: t('Migrate SDK'),
  [SdkSuggestionType.ENABLE_INTEGRATION]: t('Enable Integration'),
};

type Props = {
  type: SdkSuggestionType;
  suggestion: React.ReactNode;
  withGoToBroadcastAction?: boolean;
};

function SdkAlert({type, suggestion, withGoToBroadcastAction}: Props) {
  return (
    <Alert type="info" icon={<IconUpgrade />}>
      {withGoToBroadcastAction ? (
        <AlertContent>
          {suggestion}
          <StyledButton
            priority="link"
            onClick={() => {
              SidebarPanelActions.activatePanel(SidebarPanelKey.Broadcasts);
            }}
          >
            {actionDescription[type]}
          </StyledButton>
        </AlertContent>
      ) : (
        suggestion
      )}
    </Alert>
  );
}

export default SdkAlert;

const AlertContent = styled('div')`
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;

  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    justify-content: space-between;
  }
`;

const StyledButton = styled(Button)`
  /* this is needed to be aligned with the alert icon
   * which currently has a height of 22px. */
  height: 22px;
`;
