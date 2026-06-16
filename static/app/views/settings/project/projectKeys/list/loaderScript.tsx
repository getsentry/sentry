import {Stack} from '@sentry/scraps/layout';
import {ExternalLink, Link} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';

import {TextCopyInput} from 'sentry/components/textCopyInput';
import {t, tct} from 'sentry/locale';
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import type {ProjectKey} from 'sentry/types/project';
import {recreateRoute} from 'sentry/utils/recreateRoute';

type Props = {
  projectKey: ProjectKey;
} & Pick<RouteComponentProps, 'routes' | 'location' | 'params'>;

export function LoaderScript({projectKey, routes, params, location}: Props) {
  const loaderLink = projectKey.dsn.cdn;

  const editUrl = recreateRoute(`${projectKey.id}/`, {routes, params, location});

  return (
    <Stack padding="xl" gap="md">
      <Text>{t('Loader Script')}</Text>
      <Text size="sm" variant="muted">
        {tct(
          'Copy this script into your website to setup your JavaScript SDK without any additional configuration. [link]',
          {
            link: (
              <ExternalLink href="https://docs.sentry.io/platforms/javascript/install/lazy-load-sentry/">
                {t(' What does the script provide?')}
              </ExternalLink>
            ),
          }
        )}
      </Text>
      <TextCopyInput aria-label={t('Loader Script')}>
        {`<script src='${loaderLink}' crossorigin="anonymous"></script>`}
      </TextCopyInput>
      <Text size="sm" variant="muted">
        {tct(
          'You can [configureLink:configure] the Loader Script to enable/disable Performance, Replay, and more.',
          {
            configureLink: <Link to={editUrl} />,
          }
        )}
      </Text>
    </Stack>
  );
}
