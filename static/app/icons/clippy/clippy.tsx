import styled from '@emotion/styled';

import image from 'sentry-images/clippy.gif';

const Clippy = ({event}: any) => {
  const stacktraceEntry = event?.entries?.find(x => x.type === 'exception');
  console.log('stack trace entry', stacktraceEntry);
  console.log('event', event);

  async function handleClick() {
    // get stack trace

    const result = await fetch('');
  }

  return (
    <ClippyWrapper>
      <img onClick={handleClick} height={200} alt="clippy assistant" src={image} />
    </ClippyWrapper>
  );
};

export default Clippy;

const ClippyWrapper = styled('div')`
  position: absolute;
  left: 25%;
  top: 0;
  bottom: 0;
  z-index: 1000;
  cursor: pointer;
`;
