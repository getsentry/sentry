/* eslint-disable react/prop-types */
import React from 'react';
import styled from '@emotion/styled';

import Flex from 'app/components/flex';
import Text from 'app/components/text';
import TextOverflow from 'app/components/textOverflow';
import space from 'app/styles/space';

export enum ThreadsSelectorOptionLabelType {
  FILENAME = 'filename',
  PACKAGE = 'package',
  MODULE = 'module',
}

interface Props {
  label: ThreadsSelectorOptionLabelType;
  value: string;
}

const StyledText = styled(Text)(({theme}) => ({
  fontWeight: 600,
  marginRight: space(0.5),
  color: theme.gray1,
}));

// TODO: use i18n here
const ThreadsSelectorOptionLabel: React.FC<Props> = ({label, value}) => {
  switch (label) {
    case ThreadsSelectorOptionLabelType.PACKAGE:
      return (
        <Flex>
          <StyledText>Package:</StyledText>
          <TextOverflow>{value}</TextOverflow>
        </Flex>
      );
    case ThreadsSelectorOptionLabelType.FILENAME:
      return (
        <Flex>
          <StyledText>Filename:</StyledText>
          <TextOverflow>{value}</TextOverflow>
        </Flex>
      );
    case ThreadsSelectorOptionLabelType.MODULE:
      return (
        <Flex>
          <StyledText>Module:</StyledText>
          <TextOverflow>{value}</TextOverflow>
        </Flex>
      );
    default:
      return null;
  }
};

export default ThreadsSelectorOptionLabel;
