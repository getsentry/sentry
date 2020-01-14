import PropTypes from 'prop-types';
import React from 'react';
import styled from '@emotion/styled';

import {t} from 'app/locale';
import InlineSvg from 'app/components/inlineSvg';
import SentryTypes from 'app/sentryTypes';
import space from 'app/styles/space';

import {Incident, IncidentStatus} from './types';

type Props = {
  className?: string;
  incident: Incident;
};

export default class Status extends React.Component<Props> {
  static propTypes = {
    className: PropTypes.string,
    incident: SentryTypes.Incident,
  };

  render() {
    const {className, incident} = this.props;
    const isIncidentOpen = incident.status !== IncidentStatus.CLOSED;

    // TODO(incidents): Make this work
    const status = !isIncidentOpen
      ? 'resolved'
      : incident.status === IncidentStatus.CREATED
      ? 'critical'
      : 'warning';
    const isResolved = status === 'resolved';
    const isCritical = status === 'critical';

    const icon = isResolved
      ? 'icon-circle-check'
      : isCritical
      ? 'icon-circle-exclamation'
      : 'icon-warning-sm';

    const text = isResolved ? t('Resolved') : isCritical ? t('Critical') : t('Warning');

    return (
      <Wrapper status={status} className={className}>
        <Icon src={icon} status={status} isOpen={isIncidentOpen} />
        {text}
      </Wrapper>
    );
  }
}

type StatusType = 'warning' | 'critical' | 'resolved';

type WrapperProps = {status: StatusType};

function getHighlight({theme, status}) {
  if (status === 'resolved') {
    return theme.greenDark;
  } else if (status === 'warning') {
    return theme.yellowDark;
  }

  return theme.redDark;
}

function getColor({theme, status}) {
  if (status === 'resolved') {
    return theme.greenLightest;
  } else if (status === 'warning') {
    return theme.yellowLightest;
  }

  return theme.redLightest;
}

const Wrapper = styled('div')<WrapperProps>`
  display: flex;
  align-items: center;
  justify-self: flex-start;
  background-color: ${getColor};
  border: 1px solid ${getHighlight};
  border-radius: ${p => p.theme.borderRadius};
  color: ${getHighlight};
  padding: 0 ${space(0.5)};
  font-size: ${p => p.theme.fontSizeSmall};
  text-transform: uppercase;
`;

const Icon = styled(InlineSvg)<WrapperProps & {isOpen: boolean}>`
  color: ${getHighlight};
  margin-right: ${space(0.5)};
  font-size: ${p => p.theme.fontSizeMedium};
`;
