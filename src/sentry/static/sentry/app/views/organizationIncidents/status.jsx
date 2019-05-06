import React from 'react';
import styled from 'react-emotion';

import InlineSvg from 'app/components/inlineSvg';
import SentryTypes from 'app/sentryTypes';
import space from 'app/styles/space';

import {isResolved} from './utils';

export default class Status extends React.Component {
  static propTypes = {
    incident: SentryTypes.Incident.isRequired,
  };

  render() {
    const isIncidentResolved = isResolved(this.props.incident);

    const icon = isIncidentResolved ? 'icon-circle-check' : 'icon-circle-exclamation';
    const text = isIncidentResolved ? 'Resolved' : 'Active';

    return (
      <Container>
        <Icon src={icon} isResolved={isIncidentResolved} />
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
  color: ${p => (p.isResolved ? p.theme.success : p.theme.error)};
  margin-right: ${space(0.5)};
`;
