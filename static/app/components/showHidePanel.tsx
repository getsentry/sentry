import {ReactNode, useState} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import {IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

interface Props {
  content: () => ReactNode;
  expandedByDefault: boolean;
  headerHide: () => ReactNode;
  headerShow: () => ReactNode;
}

export default function ShowHidePanel({
  expandedByDefault,
  headerShow,
  headerHide,
  content,
}: Props) {
  const [isShown, setIsShown] = useState(expandedByDefault);

  return (
    <PanelContainer>
      <ListItemContainer>
        <StyledButton
          icon={<IconChevron size="xs" direction={isShown ? 'up' : 'down'} />}
          aria-label={t('Expand')}
          aria-expanded={isShown}
          size="zero"
          borderless
          onClick={() => {
            isShown ? setIsShown(false) : setIsShown(true);
          }}
        >
          {isShown ? headerHide() : headerShow()}
        </StyledButton>
      </ListItemContainer>
      {isShown && content()}
    </PanelContainer>
  );
}

const PanelContainer = styled('ul')`
  line-height: ${p => p.theme.text.lineHeightBody};
  margin: 0;
  padding: 0;
  list-style-type: none;
`;

const ListItemContainer = styled('div')`
  display: flex;
  font-size: ${p => p.theme.fontSizeMedium};
`;

const StyledButton = styled(Button)`
  padding: ${space(0.75)};
`;
