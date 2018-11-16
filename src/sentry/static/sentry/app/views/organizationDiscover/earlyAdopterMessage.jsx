import React from 'react';
import styled from 'react-emotion';

import PreviewFeature from 'app/components/previewFeature';

export default class EarlyAdopterMessage extends React.Component {
  render() {
    return <StyledPreviewFeature />;
  }
}

const StyledPreviewFeature = styled(PreviewFeature)`
  margin-bottom: 0;
`;
