import {useState} from 'react';
import styled from '@emotion/styled';

import image from 'sentry-images/clippy.gif';
import evilClippy from 'sentry-images/evil-clippy.png';
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
  const [isEvil, makeClippyEvil] = useState(false);
  const [displayWelcomeMessage, setWelcomeMessage] = useState(false);

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
      toggleIsFinalStep(false);
      makeClippyEvil(false);
      setWelcomeMessage(false);

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
      } else {
        setResolutionSteps([]);
      }

      let resolution = _content
        ?.slice(_content.indexOf('Resolution') + 12)
        .trimStart()
        .split('- ')
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

  function killClippy(makeEvil) {
    toggleIsFinalStep(false);
    setContent('');
    setResolutionSteps([]);
    setWelcomeMessage(false);

    if (makeEvil) {
      makeClippyEvil(true);
    }
  }

  return (
    <ClippyWrapper>
      {loading && <img height={200} alt="clippy assistant" src={image} />}
      {!loading && isEvil && (
        <img
          onClick={() => setWelcomeMessage(true)}
          height={100}
          style={{margin: '50px 20px 20px 50px'}}
          alt="clippy assistant"
          src={evilClippy}
        />
      )}
      {!isEvil && !loading && (
        <img
          onClick={() => setWelcomeMessage(true)}
          height={200}
          alt="clippy assistant"
          src={staticImage}
        />
      )}
      {displayWelcomeMessage && (
        <Wrapper>
          <FirstTitle>
            It looks like you're having a production issue, would you like me to summarize
            the problem?
          </FirstTitle>
          <ButtonWrapper>
            <Button onClick={handleClick}>Yes</Button>
            <Button onClick={() => killClippy(true)}>Nope 💩</Button>
          </ButtonWrapper>
        </Wrapper>
      )}
      {content && !loading && (
        <Wrapper>
          {!isFinalStep && <p style={{padding: '2px'}}>{content}</p>}
          {isFinalStep && (
            <ListWrapper>
              {resolutionSteps.map((step, index) => (
                <ListItem key={index}>{step}</ListItem>
              ))}
            </ListWrapper>
          )}
          <HR />
          {!isFinalStep && <Title>Would you like me to tell you how to fix it?</Title>}
          {!isFinalStep && (
            <ButtonWrapper>
              <Button onClick={() => toggleIsFinalStep(true)}>Yes</Button>
              <Button onClick={() => toggleIsFinalStep(true)}>YES!</Button>
            </ButtonWrapper>
          )}
          {isFinalStep && <Title>Was I helpful?</Title>}
          {isFinalStep && (
            <ButtonWrapper>
              <Button onClick={() => killClippy(false)}>Yes ❤️</Button>
              <Button onClick={() => killClippy(true)}>Nope 💩</Button>
            </ButtonWrapper>
          )}
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

const HR = styled('div')`
  height: 1px;
  width: 100%;
  background-color: rgba(0, 0, 0, 0.25);
`;

const FirstTitle = styled('h4')`
  font-weight: 600;
  font-size: 16px;
  padding: 0px 8px 8px;
  margin: 0;
`;

const Title = styled('h4')`
  font-weight: 600;
  font-size: 16px;
  padding: 20px 4px 6px;
  margin: 0;
`;

const Wrapper = styled('div')`
  width: 400px;
  max-height: 500px;
  height: fit-content;
  background-color: #fbf1c7;
  border: 1px solid transparent;
  border-radius: 2px;
  padding: 16px 12px;
  font-weight: 600;
  font-size: 14px;
  position: relative;
  white-space: pre-wrap;
  word-break: break-word;

  :before {
    content: '';
    width: 0px;
    height: 0px;
    position: absolute;
    border-left: 14px solid transparent;
    border-right: 15px solid #fbf1c7;
    border-top: 18px solid transparent;
    border-bottom: 18px solid #fbf1c7;
    top: -36px;
  }
`;

const Button = styled('button')`
  background-color: transparent;
  border: 1px solid rgba(0, 0, 0, 0.25);
  border-radius: 2px;
  width: 100px;
  :hover {
    text-decoration: underline;
  }
`;

const ButtonWrapper = styled('div')`
  display: flex;
  justify-content: space-between;
  padding: 6px 0 0 0;
`;

const ListWrapper = styled('ul')`
  list-style: none;
  padding: 0;
`;

const ListItem = styled('li')`
  padding: 4px 8px;

  :before {
    border-style: solid;
    border-width: 3px 3px 0 0;
    content: '';
    display: inline-block;
    height: 8px;
    left: -8px;
    position: relative;
    top: 6px;
    transform: rotate(45deg);
    vertical-align: top;
    width: 8px;
  }
`;
