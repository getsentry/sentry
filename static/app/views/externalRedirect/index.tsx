import {useEffect, useState} from 'react';
import styled from '@emotion/styled';

import Panel from 'sentry/components/panels/panel';
import {tct} from 'sentry/locale';

function ExternalRedirect() {
  const [count, setCount] = useState<number>(5);
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null);

  useEffect(() => {
    const queryParams = new URLSearchParams(window.location.search);
    const url = queryParams.get('url');

    if (!url) {
      return;
    }

    setRedirectUrl(url);

    const intervalId = setInterval(() => {
      setCount(prevCount => prevCount - 1);
    }, 1000);

    // eslint-disable-next-line consistent-return
    return () => clearInterval(intervalId);
  }, []);

  if (redirectUrl && count <= 0) {
    window.location.href = redirectUrl;
  }

  return (
    <div className="app">
      <RedirectContainer>
        <div className="pattern-bg" />
        <AuthPanel>
          <div>
            {tct('In [count] seconds you will be redirected to [redirectUrl].', {
              count,
              redirectUrl: <strong>{redirectUrl}</strong>,
            })}
          </div>
          <div>
            {tct('Changed your mind? [link:Go back to Sentry]', {
              link: (
                <a href="#" onClick={() => window.close()}>
                  Go back to Sentry
                </a>
              ),
            })}
          </div>
        </AuthPanel>
      </RedirectContainer>
    </div>
  );
}

const RedirectContainer = styled('div')`
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 5vh;
`;

const AuthPanel = styled(Panel)`
  width: 550px;
  text-align: center;
  word-wrap: break-word;
  padding: 2rem;
`;

export default ExternalRedirect;
