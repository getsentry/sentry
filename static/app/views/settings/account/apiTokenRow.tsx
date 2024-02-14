import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import DateTime from 'sentry/components/dateTime';
import PanelItem from 'sentry/components/panels/panelItem';
import {IconSubtract} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {InternalAppApiToken} from 'sentry/types';
import getDynamicText from 'sentry/utils/getDynamicText';
import {tokenPreview} from 'sentry/views/settings/organizationAuthTokens';

type Props = {
  onRemove: (token: InternalAppApiToken) => void;
  token: InternalAppApiToken;
  tokenPrefix?: string;
};

function ApiTokenRow({token, onRemove, tokenPrefix = ''}: Props) {
  return (
    <StyledPanelItem>
      <Controls>
        {token.name ? token.name : ''}
        <ButtonWrapper>
          <Button
            data-test-id="token-delete"
            onClick={() => onRemove(token)}
            icon={<IconSubtract isCircled size="xs" />}
          >
            {t('Remove')}
          </Button>
        </ButtonWrapper>
      </Controls>

      <Details>
        <TokenWrapper>
          <Heading>{t('Token')}</Heading>
          <TokenPreview aria-label={t('Token preview')}>
            {tokenPreview(
              getDynamicText({
                value: token.tokenLastCharacters,
                fixed: 'ABCD',
              }),
              tokenPrefix
            )}
          </TokenPreview>
        </TokenWrapper>
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
                fixed: new Date(1508208080000), // National Pasta Day
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

const Details = styled('div')`
  display: flex;
  margin-top: ${space(1)};
`;

const TokenWrapper = styled('div')`
  flex: 1;
  margin-right: ${space(1)};
`;

const ScopesWrapper = styled('div')`
  flex: 2;
  margin-right: ${space(4)};
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
  color: ${p => p.theme.subText};
  margin-bottom: ${space(1)};
`;

const TokenPreview = styled('div')`
  color: ${p => p.theme.gray300};
`;

const ButtonWrapper = styled('div')`
  margin-left: auto;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  justify-content: flex-end;
  font-size: ${p => p.theme.fontSizeSmall};
  gap: ${space(1)};
`;

export default ApiTokenRow;
