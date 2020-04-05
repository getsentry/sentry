import React from 'react';
import styled from '@emotion/styled';

import {t, tct} from 'app/locale';
import Alert from 'app/components/alert';
import {IconInfo} from 'app/icons';
import space from 'app/styles/space';
import ExternalLink from 'app/components/links/externalLink';
import Link from 'app/components/links/link';

const NotFound = () => (
  <NotFoundAlert type="error" icon={<IconInfo size="lg" />}>
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
        {tct('If all else fails, [link:create an issue] with more details', {
          link: <ExternalLink href="http://github.com/getsentry/sentry/issues" />,
        })}
      </li>
    </ul>
    <p>
      {tct('Not sure what to do? [link:Return to the dashboard]', {
        link: <Link to="/" />,
      })}
    </p>
  </NotFoundAlert>
);

const NotFoundAlert = styled(Alert)`
  margin: ${space(3)} 0;
`;

const Heading = styled('h1')`
  font-size: ${p => p.theme.fontSizeExtraLarge};
  margin: ${space(1)} 0;
`;

export default NotFound;
