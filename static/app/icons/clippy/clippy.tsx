import {useState} from 'react';
import styled from '@emotion/styled';

import image from 'sentry-images/clippy.gif';
import staticImage from 'sentry-images/static-clippy.gif';

import {
  getPreamble,
  getPythonFrame,
} from 'sentry/components/events/interfaces/crashContent/stackTrace/rawContent';

import {openai} from '../../main';

import {STOP_SEQ, TRAINING_PROMPT} from './trainingPrompt';

const Clippy = ({event}: any) => {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);

  const exceptions =
    event?.entries?.find(x => x.type === 'exception')?.data?.values || [];
  const stacktrace = getRawStacktrace();

  function getRawStacktrace() {
    const traces = exceptions.map(exc => rawStacktraceContent(exc.stacktrace, exc));
    return traces[0];
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
    try {
      setLoading(true);
      setContent('');
      const {data} = await openai.createCompletion({
        model: 'text-davinci-002',
        prompt: `${TRAINING_PROMPT}\n${stacktrace}${STOP_SEQ}`,
        temperature: 0,
        max_tokens: 500,
        top_p: 1,
        frequency_penalty: 0,
        presence_penalty: 0,
        stop: [`\"\"\"`, 'END'],
      });
      const _content = data.choices ? data?.choices[0]?.text : '';

      // Summary:
      // Resultion:
      if (_content) {
        setContent(_content);
      }
    } catch (e) {
      setContent("Clippy couldn't find anything 💩");
    } finally {
      setLoading(false);
    }
  }

  return (
    <ClippyWrapper>
      {loading && (
        <img onClick={handleClick} height={200} alt="clippy assistant" src={image} />
      )}
      {!loading && (
        <img
          onClick={handleClick}
          height={200}
          alt="clippy assistant"
          src={staticImage}
        />
      )}
      {content && !loading && (
        <Wrapper>
          <p>{content}</p>
          <ButtonWrapper>
            <Button>Yes</Button>
            <Button>YES!</Button>
          </ButtonWrapper>
        </Wrapper>
      )}
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
  font-family: monospace;
`;

const Wrapper = styled('div')`
  left: 50%;
  width: 400px;
  max-height: 500px;
  height: fit-content;
  background-color: #fbf1c7;
  border: 1px solid black;
  border-radius: 4px;
  padding: 5px 8px;
`;

const Button = styled('button')`
  background-color: transparent;
  border: 1px solid #bfbfbf;
  border-radius: 4px;
  width: 60px;
  :hover {
    text-decoration: underline;
  }
`;

const ButtonWrapper = styled('div')`
  display: flex;
  justify-content: space-between;
`;
