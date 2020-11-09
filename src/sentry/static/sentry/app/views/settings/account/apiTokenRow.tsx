import React from 'react';
import styled from '@emotion/styled';

import {InternalAppApiToken} from 'app/types';
import {IconSubtract} from 'app/icons';
import {t} from 'app/locale';
import space from 'app/styles/space';
import Button from 'app/components/button';
import DateTime from 'app/components/dateTime';
import {PanelItem} from 'app/components/panels';
import getDynamicText from 'app/utils/getDynamicText';
import TextCopyInput from 'app/views/settings/components/forms/textCopyInput';

type Props = {
  token: InternalAppApiToken;
  onRemove: (token: InternalAppApiToken) => void;
};

function ApiTokenRow({token, onRemove}: Props) {
  return (
    <StyledPanelItem>
      <Controls>
        <InputWrapper>
          <TextCopyInput>
            {getDynamicText({value: token.token, fixed: 'CI_AUTH_TOKEN'})}
          </TextCopyInput>
        </InputWrapper>
        <Button
          size="small"
          onClick={() => onRemove(token)}
          icon={<IconSubtract isCircled size="xs" />}
        >
          {t('Remove')}
        </Button>
      </Controls>

      <Details>
        <ScopesWrapper>
          <Heading>{t('Scopes')}</Heading>
          <ScopeList>{token.scopes.join(', ')}</ScopeList>
        </ScopesWrapper>
        <div>
          <Heading>{t('Created')}</Heading>
          <Time>
            <DateTime
              date={getDynamicText({
                value: token.dateCreated,
                fixed: new Date(1508208080000), //National Pasta Day
              })}
            />
          </Time>
        </div>
      </Details>
    </StyledPanelItem>
  );
}

const StyledPanelItem = styled(PanelItem)`
  flex-direction: column;
  padding: ${space(2)};
`;

const Controls = styled('div')`
  display: flex;
  align-items: center;
  margin-bottom: ${space(1)};
`;

const InputWrapper = styled('div')`
  font-size: ${p => p.theme.fontSizeRelativeSmall};
  flex: 1;
  margin-right: ${space(1)};
`;

const Details = styled('div')`
  display: flex;
  margin-top: ${space(1)};
`;

const ScopesWrapper = styled('div')`
  flex: 1;
`;

const ScopeList = styled('div')`
  font-size: ${p => p.theme.fontSizeRelativeSmall};
  line-height: 1.4;
`;

const Time = styled('time')`
  font-size: ${p => p.theme.fontSizeRelativeSmall};
  line-height: 1.4;
`;

const Heading = styled('div')`
  font-size: ${p => p.theme.fontSizeMedium};
  text-transform: uppercase;
  color: ${p => p.theme.gray600};
  margin-bottom: ${space(1)};
`;

export default ApiTokenRow;
