import React from 'react';
import styled from '@emotion/styled';
import xor from 'lodash/xor';
import QRCode from 'qrcode.react';

import appStore from 'sentry-images/logos/app-store.svg';
import playStore from 'sentry-images/logos/play-store.svg';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'app/actionCreators/indicator';
import Button from 'app/components/button';
import ExternalLink from 'app/components/links/externalLink';
import List from 'app/components/list';
import ListItem from 'app/components/list/listItem';
import {t, tct} from 'app/locale';
import space from 'app/styles/space';
import {InternalAppApiToken, Organization, Project} from 'app/types';
import AsyncView from 'app/views/asyncView';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import TextBlock from 'app/views/settings/components/text/textBlock';

import TextCopyInput from '../../components/forms/textCopyInput';

export const MOBILE_APP_SCOPES = [
  'project:releases',
  'project:read',
  'project:write',
  'event:read',
  'team:read',
  'org:read',
  'member:read',
  'alerts:read',
];

const QR_WIDTH = 270;

type Props = AsyncView['props'] & {
  organization: Organization;
  project: Project;
};

type State = AsyncView['state'] & {
  tokenList: InternalAppApiToken[] | null;
};

class MobileApp extends AsyncView<Props, State> {
  getTitle() {
    return t('Mobile App');
  }

  getDefaultState(): State {
    return {
      ...super.getDefaultState(),
      tokenList: [],
    };
  }

  getEndpoints(): ReturnType<AsyncView['getEndpoints']> {
    return [['tokenList', '/api-tokens/']];
  }

  handleGenerateCodeClick = async () => {
    try {
      addLoadingMessage(t('Creating Auth Token\u2026'));
      const response = await this.api.requestPromise('/api-tokens/', {
        method: 'POST',
        data: {
          scopes: MOBILE_APP_SCOPES,
        },
      });
      this.setState(state => ({
        tokenList: [...(state.tokenList ?? []), response],
      }));
      addSuccessMessage(t('Auth Token created successfully'));
    } catch (e) {
      addErrorMessage(t('Unable to create Auth Token'));
      throw e;
    }
  };

  getTheRightToken() {
    const {tokenList} = this.state;

    return tokenList?.find(token => xor(token.scopes, MOBILE_APP_SCOPES).length === 0);
  }

  getContentsOfQr(token: InternalAppApiToken) {
    return btoa(JSON.stringify({authToken: token?.token}));
  }

  renderBody() {
    const token = this.getTheRightToken();

    return (
      <React.Fragment>
        <SettingsPageHeader title={t('Mobile App')} />

        <TextBlock>
          {/* TODO(mobile-app): replace copy and docs/blog link */}
          {tct(
            `Sentry mobile application is lorem, ipsum dolor sit amet consectetur adipisicing elit. Iste nostrum incidunt possimus suscipit magnam. To learn more about the app, [link: read the docs].`,
            {
              link: <ExternalLink href="https://docs.sentry.io" />,
            }
          )}
        </TextBlock>

        <List symbol="colored-numeric">
          <ListItem>
            {t('Get our app in one of the app stores')}:
            {/* TODO(mobile-app): add production links */}
            <div>
              <ExternalLink href="https://apps.apple.com">
                <img
                  alt={t('Download on the App Store')}
                  src={appStore}
                  height="40px"
                  width="120px"
                />
              </ExternalLink>

              <ExternalLink href="https://play.google.com/store/apps/">
                <img alt={t('Get it on Google Play')} src={playStore} height="60px" />
              </ExternalLink>
            </div>
          </ListItem>
          <ListItem>
            {t('Get the token:')}
            {token ? (
              <Wrapper>
                <QRCode value={this.getContentsOfQr(token)} size={QR_WIDTH} />
                <InputWrapper>
                  <TextCopyInput>{token.token}</TextCopyInput>
                </InputWrapper>
              </Wrapper>
            ) : (
              <Wrapper>
                <Blur>
                  <QRCode value="https://sentry.io/" size={QR_WIDTH} />
                </Blur>
                <StyledButton onClick={this.handleGenerateCodeClick} priority="primary">
                  {t('Generate Auth Token')}
                </StyledButton>
              </Wrapper>
            )}
          </ListItem>
          <ListItem>{t('Scan/paste into the app to authenticate.')}</ListItem>
        </List>
      </React.Fragment>
    );
  }
}

const Wrapper = styled('div')`
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
  width: ${QR_WIDTH}px;
  margin: ${space(3)} 0;
`;

const InputWrapper = styled('div')`
  margin-top: ${space(1)};
  width: ${QR_WIDTH}px;
`;

const Blur = styled('div')`
  filter: blur(5px);
  opacity: 0.3;
`;

const StyledButton = styled(Button)`
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
`;

export default MobileApp;
