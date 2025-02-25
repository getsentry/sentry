import styled from '@emotion/styled';

import {Alert} from 'sentry/components/core/alert/alert';
import ExternalLink from 'sentry/components/links/externalLink';
import Link from 'sentry/components/links/link';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';

function NotFound() {
  return (
    <Alert.Container>
      <Alert type="error" showIcon>
        <Heading>{t('Page Not Found')}</Heading>
        <p>{t('The page you are looking for was not found.')}</p>
        <p>{t('You may wish to try the following:')}</p>
        <ul>
          <li>
            {t(
              `If you entered the address manually, double check the path. Did you
           forget a trailing slash?`
            )}
          </li>
          <li>
            {t(
              `If you followed a link here, try hitting back and reloading the
           page. It's possible the resource was moved out from under you.`
            )}
          </li>
          <li>
            {tct('If all else fails, [link:contact us] with more details', {
              link: (
                <ExternalLink href="https://github.com/getsentry/sentry/issues/new/choose" />
              ),
            })}
          </li>
        </ul>
        <p>
          {tct('Not sure what to do? [link:Return to the dashboard]', {
            link: <Link to="/" />,
          })}
        </p>
      </Alert>
    </Alert.Container>
  );
}

const Heading = styled('h1')`
  font-size: ${p => p.theme.fontSizeLarge};
  line-height: 1.4;
  margin-bottom: ${space(1)};
`;

export default NotFound;
