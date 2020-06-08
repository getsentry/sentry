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
import Tooltip from 'app/components/tooltip';

// TODO(Priscila): Update the png below to SVG
import relayIcon from './relay-icon.png';

const RELAY_DOCS_LINK = 'https://getsentry.github.io/relay/';

type Relay = {
  id: string;
  name: string;
  last_used: string;
  last_modified: string;
  created: string;
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
    id: '1',
    name: 'First key',
    description: 'optional description for the key',
    last_used: '2020-02-07T15:17:00Z',
    last_modified: '2020-02-07T15:17:00Z',
    created: '2020-02-07T15:17:00Z',
  },
  {
    id: '2',
    name: 'Second key',
    last_used: '2020-02-07T15:17:00Z',
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

  handleDelete = (id: Relay['id']) => () => {};

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
            {relays.map(({id, name}) => (
              <Grid key={id}>
                <GridCell>
                  <img src={relayIcon} height="36px" />
                </GridCell>
                <GridCell>
                  <Name>{name}</Name>
                </GridCell>
                <GridCell>
                  <Tooltip title={t('Delete Rule')}>
                    <Button
                      label={t('Delete Rule')}
                      size="small"
                      onClick={this.handleDelete(id)}
                      icon={<IconDelete />}
                    />
                  </Tooltip>
                </GridCell>
              </Grid>
            ))}
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

const Grid = styled('div')`
  display: grid;
  grid-template-columns: max-content 1fr max-content;
  align-items: center;
  margin-bottom: -1px;
`;

const GridCell = styled('div')`
  height: 100%;
  padding: ${space(1)};
  border-bottom: 1px solid ${p => p.theme.borderDark};
  > *:nth-last-child(-n + 3) {
    border-bottom: 0;
  }
`;

const PanelAction = styled('div')`
  padding: ${space(1)} ${space(2)};
  display: grid;
  grid-gap: ${space(1)};
  grid-template-columns: auto auto;
  justify-content: flex-end;
  border-top: 1px solid ${p => p.theme.borderDark};
`;

const Name = styled('h5')`
  font-size: ${p => p.theme.fontSizeLarge} !important;
  font-weight: 600;
`;
