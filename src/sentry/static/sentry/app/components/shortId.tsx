import PropTypes from 'prop-types';
import React from 'react';
import styled from '@emotion/styled';

import AutoSelectText from 'app/components/autoSelectText';

type Props = {
  shortId: string;
  avatar?: React.ReactNode;
};

export default class ShortId extends React.Component<Props> {
  static propTypes = {
    shortId: PropTypes.string.isRequired,
    avatar: PropTypes.node,
  };

  preventPropagation(e: React.MouseEvent) {
    // this is a hack for the stream so the click handler doesn't
    // affect this element
    e.stopPropagation();
  }

  render() {
    const {shortId, avatar} = this.props;

    if (!shortId) {
      return null;
    }

    return (
      <StyledShortId onClick={this.preventPropagation} {...this.props}>
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

const StyledAutoSelectText = styled(AutoSelectText)<{
  avatar: boolean;
}>`
  margin-left: ${p => p.avatar && '0.5em'};
  min-width: 0;
`;
