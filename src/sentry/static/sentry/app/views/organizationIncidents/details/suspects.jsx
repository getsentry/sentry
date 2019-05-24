import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import {Panel, PanelBody, PanelItem} from 'app/components/panels';
import {t} from 'app/locale';
import SideHeader from 'app/views/organizationIncidents/details/sideHeader';
import space from 'app/styles/space';

export default class Suspects extends React.Component {
  static propTypes = {
    // TODO: Make this a shape once we figure out data model
    suspects: PropTypes.array,
  };

  renderEmpty() {
    return t('No suspects found');
  }

  render() {
    const {suspects} = this.props;

    return (
      <Container>
        <SideHeader>{t('Suspects')}</SideHeader>
        {suspects && suspects.length > 0 && (
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
        {(!suspects || suspects.length === 0) && this.renderEmpty()}
      </Container>
    );
  }
}

const Container = styled('div')`
  margin-top: ${space(1)};
`;
