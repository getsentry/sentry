import {useEffect, useState} from 'react';
import styled from '@emotion/styled';

import Panel from 'sentry/components/panels/panel';
import {t, tct} from 'sentry/locale';
import {isUrl} from 'sentry/utils';

function ExternalRedirect() {
  const [count, setCount] = useState<number>(5);
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    const queryParams = new URLSearchParams(window.location.search);
    const url = queryParams.get('url');

    if (url && isUrl(url)) {
      setRedirectUrl(url);
    } else {
      setIsError(true);
    }

    const intervalId = setInterval(() => {
      setCount(prevCount => prevCount - 1);
    }, 1000);

    // eslint-disable-next-line consistent-return
    return () => clearInterval(intervalId);
  }, []);

  if (redirectUrl && count <= 0) {
    window.location.href = redirectUrl;
  } else if (count <= 0) {
    window.close();
  }

  if (isError) {
    return (
      <div className="app">
        <RedirectContainer>
          <div className="pattern-bg" />
          <AuthPanel>
            <div>{t('Error: Invalid URL')}</div>
            <div>{tct('In [count] seconds, this tab will close', {count})}</div>
          </AuthPanel>
        </RedirectContainer>
      </div>
    );
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
