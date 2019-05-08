import React from 'react';
import styled from 'react-emotion';

import InlineSvg from 'app/components/inlineSvg';
import SentryTypes from 'app/sentryTypes';
import space from 'app/styles/space';
import {t} from 'app/locale';

import {isOpen} from './utils';

export default class Status extends React.Component {
  static propTypes = {
    incident: SentryTypes.Incident.isRequired,
  };

  render() {
    const isIncidentOpen = isOpen(this.props.incident);

    const icon = isIncidentOpen ? 'icon-circle-exclamation' : 'icon-circle-check';
    const text = isIncidentOpen ? t('Open') : t('Closed');

    return (
      <Container>
        <Icon src={icon} isOpen={isIncidentOpen} />
        {text}
      </Container>
    );
  }
}

const Container = styled('div')`
  display: flex;
  align-items: center;
`;

const Icon = styled(InlineSvg)`
  color: ${p => (p.isOpen ? p.theme.error : p.theme.success)};
  margin-right: ${space(0.5)};
`;
