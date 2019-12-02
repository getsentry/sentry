import React from 'react';
import styled from 'react-emotion';

import Tooltip from 'app/components/tooltip';
import space from 'app/styles/space';
import {t} from 'app/locale';

type Props = {
  address: string;
  absolute: boolean;
  onToggle?: () => void;
};

class TogglableAddress extends React.Component<Props> {
  render() {
    const {address, absolute, onToggle} = this.props;

    return (
      <Address>
        {onToggle && (
          <Tooltip title={absolute ? t('Absolute') : t('Relative')}>
            <Toggle className="icon-filter" onClick={onToggle} />
          </Tooltip>
        )}
        {!absolute && '+'}
        <span>{address}</span>
      </Address>
    );
  }
}

const Toggle = styled('span')`
  opacity: 0.33;
  margin-right: 1ex;
  cursor: pointer;
  visibility: hidden;

  &:hover {
    opacity: 1;
  }
`;

const Address = styled('span')`
  font-family: ${p => p.theme.text.familyMono};
  font-size: 11px;
  color: ${p => p.theme.foreground};
  letter-spacing: -0.25px;
  width: 100px;
  flex-grow: 0;
  flex-shrink: 0;
  display: block;
  padding: 0 ${space(0.5)};
  &:hover ${Toggle} {
    visibility: visible;
  }
`;

export default TogglableAddress;
