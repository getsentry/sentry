import styled from 'react-emotion';

const Text = styled.div`
  h1,
  h2,
  h3,
  h4,
  h5,
  h6,
  p,
  ul,
  ol,
  table,
  dl,
  blockquote,
  form {
    margin-bottom: 20px;

    &:last-child {
      margin-bottom: 0;
    }
  }

  h1,
  h2,
  h3,
  h4,
  h5,
  h6 {
    line-height: 1.2;
  }

  p,
  ul,
  ol,
  blockquote {
    line-height: 1.5;
  }

  h1 {
    font-size: 32px;
  }

  h2 {
    font-size: 26px;
  }

  h3 {
    font-size: 22px;
  }

  h4 {
    font-size: 18px;
  }

  h5 {
    font-size: 16px;
  }
`;

export default Text;
