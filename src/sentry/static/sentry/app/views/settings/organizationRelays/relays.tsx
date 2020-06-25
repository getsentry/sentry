import React from 'react';
import {RouteComponentProps} from 'react-router/lib/Router';
import styled from '@emotion/styled';

import {Panel, PanelBody, PanelHeader, PanelAlert} from 'app/components/panels';
import {t, tct} from 'app/locale';
import AsyncComponent from 'app/components/asyncComponent';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import {Organization} from 'app/types';
import ExternalLink from 'app/components/links/externalLink';
import space from 'app/styles/space';
import Button from 'app/components/button';
import {IconDelete} from 'app/icons';

import Time from './time';

const RELAY_DOCS_LINK = 'https://getsentry.github.io/relay/';

type Relay = {
  public_key: string;
  name: string;
  created: string;
  first_seen: string;
  last_seen: string | null;
  last_modified?: string;
  description?: string;
};

type Props = {
  organization: Organization;
} & RouteComponentProps<{orgId: string}, {}>;

type State = AsyncComponent['state'] & {
  relays: Array<Relay>;
};

const relaysMock: Array<Relay> = [
  {
    public_key: '1:bb:6e:af:66:b4:38:e0:62:83:62:15:22:7',
    name: 'First key',
    description: 'optional description for the key',
    first_seen: '2020-02-07T15:17:00Z',
    last_seen: '2020-02-07T15:17:00Z',
    created: '2020-02-07T15:17:00Z',
  },
  {
    public_key: '2:bb:6e:af:66:b4:38:e0:62:83:62:15:22:7',
    name: 'Second key',
    description: 'optional description for the key',
    first_seen: '2020-02-07T15:17:00Z',
    last_seen: '2020-02-07T15:17:00Z',
    last_modified: '2020-02-07T15:17:00Z',
    created: '2020-02-07T15:17:00Z',
  },
];

class Relays extends AsyncComponent<Props, State> {
  getDefaultState() {
    return {
      ...super.getDefaultState(),
      relays: relaysMock,
    };
  }

  // TODO(Priscila): activate the code below as soon as the endpoint is provided
  // getEndpoints(): ReturnType<AsyncComponent['getEndpoints']> {
  //   return [['relays', `/organizations/${this.props.organization.slug}/relay-keys`]];
  // }

  // handleDelete = (id: Relay['public_key']) => () => {};

  handleAdd = () => {};

  renderBody() {
    const {relays} = this.state;
    return (
      <React.Fragment>
        <SettingsPageHeader title={t('Relays')} />
        <Panel>
          <PanelHeader>{t('Relays')}</PanelHeader>
          <PanelAlert type="info">
            {tct('For more details, see [linkToDocs].', {
              linkToDocs: (
                <ExternalLink href={RELAY_DOCS_LINK}>
                  {t('full Relay documentation')}
                </ExternalLink>
              ),
            })}
          </PanelAlert>
          <PanelBody>
            {relays.map(
              ({public_key, name, created, last_seen, first_seen, last_modified}) => (
                <Content key={public_key}>
                  <Info>
                    <InfoItem>
                      <Name>{name}</Name>
                    </InfoItem>
                    <InfoItem>
                      <PublicKey>{public_key}</PublicKey>
                    </InfoItem>
                    <InfoItem>
                      <Time label={t('Created:')} date={created} />
                    </InfoItem>
                    <InfoItem>
                      <Time label={t('First Seen:')} date={first_seen} />
                    </InfoItem>
                    <InfoItem>
                      <Time label={t('Last Seen:')} date={last_seen} />
                    </InfoItem>
                    <InfoItem>
                      <Time label={t('Last modified:')} date={last_modified} />
                    </InfoItem>
                  </Info>
                  <Button
                    title={t('Delete Rule')}
                    label={t('Delete Rule')}
                    size="small"
                    icon={<IconDelete />}
                  />
                </Content>
              )
            )}
          </PanelBody>
          <PanelAction>
            <Button href={RELAY_DOCS_LINK} target="_blank">
              {t('Read the docs')}
            </Button>
            <Button onClick={this.handleAdd} priority="primary">
              {t('Add Relay')}
            </Button>
          </PanelAction>
        </Panel>
      </React.Fragment>
    );
  }
}

export default Relays;

const Content = styled('div')`
  display: grid;
  grid-template-columns: 1fr max-content;
  align-items: center;
  border-bottom: 1px solid ${p => p.theme.borderDark};
  padding: ${space(1)} ${space(2)};
  :last-child {
    border-bottom: 0;
  }
`;

const Info = styled('div')`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  grid-gap: ${space(1)};
  > *:nth-child(1),
  > *:nth-child(2) {
    grid-column: span 4;
  }
`;

const InfoItem = styled('div')`
  display: flex;
  align-items: center;
  height: 100%;
`;

const PanelAction = styled('div')`
  padding: ${space(1)} ${space(2)};
  display: grid;
  grid-gap: ${space(1)};
  grid-template-columns: auto auto;
  justify-content: flex-end;
  border-top: 1px solid ${p => p.theme.borderDark};
`;

const Name = styled('h4')`
  font-size: ${p => p.theme.fontSizeLarge} !important;
  font-weight: 600;
  margin-bottom: 0 !important;
  color: ${p => p.theme.gray600};
`;

const PublicKey = styled('h5')`
  font-size: ${p => p.theme.fontSizeMedium} !important;
  font-weight: 400;
  margin-bottom: 0 !important;
`;
