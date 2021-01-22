import React from 'react';
import styled from '@emotion/styled';

type Props = {
  sampleRate: number;
};

function SampleRate({sampleRate}: Props) {
  return <Wrapper>{`${sampleRate * 100}\u0025`}</Wrapper>;
}

export default SampleRate;

const Wrapper = styled('div')`
  white-space: pre-wrap;
  word-break: break-all;
`;
