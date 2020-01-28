/* eslint-disable react/prop-types */
import React from 'react';
import styled from '@emotion/styled';

import Text from 'app/components/text';

export enum ThreadsSelectorOptionLabelType {
  FILENAME = 'filename',
  FUNCTION = 'function',
  PACKAGE = 'package',
  MODULE = 'module',
}

interface Props {
  label: ThreadsSelectorOptionLabelType;
  value: string;
}

// TODO(i18n): use i18n here
const ThreadsSelectorOptionLabel: React.FC<Props> = ({label, value}) => {
  switch (label) {
    case ThreadsSelectorOptionLabelType.PACKAGE:
      return <StyledText>{value}</StyledText>;
    case ThreadsSelectorOptionLabelType.FILENAME:
      return <StyledFilename>{value}</StyledFilename>;
    case ThreadsSelectorOptionLabelType.MODULE:
      return <StyledText>{value}</StyledText>;
    case ThreadsSelectorOptionLabelType.FUNCTION:
      return <StyledText>{value}</StyledText>;
    default:
      return null;
  }
};

export default ThreadsSelectorOptionLabel;

const StyledText = styled(Text)({
  maxWidth: '100%',
  overflowWrap: 'break-word',
});

const StyledFilename = styled(StyledText)({
  color: '#2c58a8',
});
