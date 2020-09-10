import PropTypes from 'prop-types';
import React from 'react';
import styled from '@emotion/styled';
import isPropValid from '@emotion/is-prop-valid';

import AutoSelectText from 'app/components/autoSelectText';

type Props = {
  shortId: string;
  avatar?: React.ReactNode;
  stopPropagation?: boolean;
};

export default class ShortId extends React.Component<Props> {
  static propTypes = {
    shortId: PropTypes.string.isRequired,
    avatar: PropTypes.node,
  };

  onClick = (event: React.MouseEvent) => {
    if (this.props.stopPropagation === false) {
      return;
    }

    // this is a hack for the stream so the click handler doesn't
    // affect this element
    event.stopPropagation();
  };

  render() {
    const {shortId, avatar} = this.props;

    if (!shortId) {
      return null;
    }

    return (
      <StyledShortId onClick={this.onClick} {...this.props}>
        {avatar}
        <StyledAutoSelectText avatar={!!avatar}>{shortId}</StyledAutoSelectText>
      </StyledShortId>
    );
  }
}

const StyledShortId = styled('div')`
  font-family: ${p => p.theme.text.familyMono};
  display: flex;
  align-items: center;
  justify-content: flex-end;
`;

const StyledAutoSelectText = styled(AutoSelectText, {shouldForwardProp: isPropValid})<{
  avatar: boolean;
}>`
  margin-left: ${p => p.avatar && '0.5em'};
  min-width: 0;
`;
