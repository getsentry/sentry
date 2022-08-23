import {useState} from 'react';
import styled from '@emotion/styled';

import image from 'sentry-images/clippy.gif';

import {
  getPreamble,
  getPythonFrame,
} from 'sentry/components/events/interfaces/crashContent/stackTrace/rawContent';

import API_KEY from './api_key';

const Clippy = ({event}: any) => {
  const [content, setContent] = useState('');

  const exceptions =
    event?.entries?.find(x => x.type === 'exception')?.data?.values || [];
  const stacktrace = getRawStacktrace();

  function getRawStacktrace() {
    const traces = exceptions.map(exc => rawStacktraceContent(exc.stacktrace, exc));
    return traces.join('\n');
  }

  function rawStacktraceContent(data, exception) {
    const frames: string[] = [];

    (data?.frames ?? []).forEach(frame => {
      frames.push(getPythonFrame(frame));
    });

    if (exception) {
      frames.unshift(getPreamble(exception, 'python'));
    }

    return frames.join('\n');
  }

  async function handleClick() {
    // get stack trace

    const result = await fetch('');
  }

  return (
    <ClippyWrapper>
      <img onClick={handleClick} height={200} alt="clippy assistant" src={image} />
      {content && <Wrapper>{content}</Wrapper>}
    </ClippyWrapper>
  );
};

export default Clippy;

const ClippyWrapper = styled('div')`
  position: absolute;
  left: 25%;
  top: 15%;
  bottom: 0;
  z-index: 1000;
  cursor: pointer;
`;

const Wrapper = styled('div')`
  position: relative;
  left: 50%;
  width: 200px;
  height: 200px;
  background-color: #fbf1c7;
  border: 1px solid black;
  border-radius: 4px;
  padding: 5px 8px;
`;
