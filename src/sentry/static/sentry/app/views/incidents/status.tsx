import PropTypes from 'prop-types';
import React from 'react';
import styled from '@emotion/styled';

import {t} from 'app/locale';
import InlineSvg from 'app/components/inlineSvg';
import SentryTypes from 'app/sentryTypes';
import space from 'app/styles/space';

import {Incident} from './types';
import {isOpen} from './utils';

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
    const isIncidentOpen = isOpen(incident);

    // TODO(incidents): Make this work
    const status = !isIncidentOpen
      ? 'resolved'
      : Math.random() < 0.5
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

// TODO(ts): type theme somehow
type WrapperProps = {theme?: any; status: StatusType};

function getHighlight({theme, status}: WrapperProps) {
  if (status === 'resolved') {
    return theme.greenDark;
  } else if (status === 'warning') {
    return theme.redDark;
  }

  return theme.yellowDark;
}

function getColor({theme, status}: WrapperProps) {
  if (status === 'resolved') {
    return theme.greenLightest;
  } else if (status === 'warning') {
    return theme.redLightest;
  }

  return theme.yellowLightest;
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
