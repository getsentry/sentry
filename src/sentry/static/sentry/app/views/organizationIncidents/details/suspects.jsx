import React from 'react';
import styled from 'react-emotion';

import {t} from 'app/locale';
import SentryTypes from 'app/sentryTypes';
import {Panel, PanelBody, PanelItem} from 'app/components/panels';
import space from 'app/styles/space';

export default class Suspects extends React.Component {
  static propTypes = {
    incident: SentryTypes.Incident.isRequired,
  };

  renderEmpty() {
    return t('No suspects found');
  }

  render() {
    const {suspects} = this.props.incident;

    return (
      <Container>
        <h6>{t('Suspects')}</h6>
        {suspects.length > 0 && (
          <Panel>
            <PanelBody>
              {suspects.map(suspect => (
                <PanelItem p={1} key={suspect.id}>
                  {suspect.type}
                </PanelItem>
              ))}
            </PanelBody>
          </Panel>
        )}
        {suspects.length === 0 && this.renderEmpty()}
      </Container>
    );
  }
}

const Container = styled('div')`
  margin-top: ${space(1)};
`;
