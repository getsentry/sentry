import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

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

    const icon = isIncidentOpen ? 'icon-circle-exclamation' : 'icon-circle-check';
    const text = isIncidentOpen ? t('Open') : t('Closed');

    return (
      <Wrapper className={className}>
        <Icon src={icon} isOpen={isIncidentOpen} />
        {text}
      </Wrapper>
    );
  }
}

const Wrapper = styled('div')`
  display: flex;
  align-items: center;
`;

const Icon = styled(InlineSvg)<{isOpen: boolean}>`
  color: ${p => (p.isOpen ? p.theme.error : p.theme.success)};
  margin-right: ${space(0.5)};
`;
