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
  const [isFinalStep, toggleIsFinalStep] = useState(false);
  const [resolutionSteps, setResolutionSteps] = useState<String[]>([]);

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
      const response = await openai.createCompletion({
        model: 'text-davinci-002',
        prompt: `${TRAINING_PROMPT}\n${stacktrace}${STOP_SEQ}`,
        temperature: 0,
        max_tokens: 400,
        top_p: 1,
        frequency_penalty: 0,
        presence_penalty: 0,
        stop: [`\"\"\"`, 'END'],
      });
      const {data} = response;
      const _content = data.choices ? data?.choices[0]?.text : '';

      const summary = _content?.slice(
        _content.indexOf('Summary: ') + 9,
        _content.indexOf('Resolution')
      );

      if (summary) {
        setContent(summary);
      }

      let resolution = _content
        ?.slice(_content.indexOf('Resolution') + 12)
        .trimStart()
        .split('-')
        .map(s => s.trim())
        .filter(Boolean);

      if (!resolution?.length) {
        resolution = ["Clippy can't fix your problems!"];
      }
      setResolutionSteps(resolution);
    } catch (e) {
      setContent('Prompt is too long.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <ClippyWrapper>
      {loading && <img height={200} alt="clippy assistant" src={image} />}
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
          {!isFinalStep && <p>{content}</p>}
          {isFinalStep && (
            <ListWrapper>
              {resolutionSteps.map((step, index) => (
                <ListItem key={index}>{step}</ListItem>
              ))}
            </ListWrapper>
          )}
          <ButtonWrapper>
            <Button onClick={() => toggleIsFinalStep(true)}>Yes</Button>
            <Button onClick={() => toggleIsFinalStep(true)}>YES!</Button>
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
  font-weight: 600;
  font-size: 14px;
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

const ListWrapper = styled('ul')`
  list-style: none;
`;

const ListItem = styled('li')`
  :before {
    border-style: solid;
    border-width: 4px 4px 0 0;
    content: '';
    display: inline-block;
    height: 8px;
    left: -12px;
    position: relative;
    top: 6px;
    transform: rotate(45deg);
    vertical-align: top;
    width: 8px;
  }
`;
