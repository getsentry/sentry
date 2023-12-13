import {useEffect, useState} from 'react';
import styled from '@emotion/styled';

import Panel from 'sentry/components/panels/panel';
import {t, tct} from 'sentry/locale';
import {isUrl} from 'sentry/utils';
import {useLocation} from 'sentry/utils/useLocation';

function ExternalRedirect() {
  const location = useLocation();
  const rawUrl = location.query?.url;
  const url = Array.isArray(rawUrl) ? rawUrl[0] : rawUrl;
  const [count, setCount] = useState(5);

  const isValidUrl = url && isUrl(url);

  useEffect(() => {
    if (!isValidUrl) {
      return;
    }

    const intervalId = setInterval(() => {
      setCount(prevCount => {
        if (prevCount <= 1) {
          window.location.href = url;
          clearInterval(intervalId);
        }
        return prevCount - 1;
      });
    }, 1000);

    // eslint-disable-next-line consistent-return
    return () => clearInterval(intervalId);
  }, [isValidUrl, url]);

  if (!isValidUrl) {
    return <InvalidUrlCloseTab />;
  }

  return (
    <div className="app">
      <RedirectContainer>
        <div className="pattern-bg" />
        <AuthPanel>
          <div>
            {tct('In [count] seconds you will be redirected to [url].', {
              count,
              url: <strong>{url}</strong>,
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

function InvalidUrlCloseTab() {
  const [count, setCount] = useState(5);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      window.close();
    }, 5000);

    const intervalId = setInterval(() => {
      setCount(prevCount => {
        if (prevCount <= 1) {
          clearInterval(intervalId);
        }
        return prevCount - 1;
      });
    }, 1000);

    return () => {
      clearTimeout(timeoutId);
      clearInterval(intervalId);
    };
  }, []);

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
