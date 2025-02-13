import {Fragment} from 'react';
import styled from '@emotion/styled';

import FieldGroup from 'sentry/components/forms/fieldGroup';
import {FieldHelp} from 'sentry/components/forms/fieldGroup/fieldHelp';
import ExternalLink from 'sentry/components/links/externalLink';
import Link from 'sentry/components/links/link';
import TextCopyInput from 'sentry/components/textCopyInput';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import type {ProjectKey} from 'sentry/types/project';
import getDynamicText from 'sentry/utils/getDynamicText';
import recreateRoute from 'sentry/utils/recreateRoute';

type Props = {
  projectKey: ProjectKey;
} & Pick<RouteComponentProps, 'routes' | 'location' | 'params'>;

export function LoaderScript({projectKey, routes, params, location}: Props) {
  const loaderLink = getDynamicText({
    value: projectKey.dsn.cdn,
    fixed: '__JS_SDK_LOADER_URL__',
  });

  const editUrl = recreateRoute(`${projectKey.id}/`, {routes, params, location});

  return (
    <Fragment>
      <FieldGroup
        label={t('Loader Script')}
        help={tct(
          'Copy this script into your website to setup your JavaScript SDK without any additional configuration. [link]',
          {
            link: (
              <ExternalLink href="https://docs.sentry.io/platforms/javascript/install/lazy-load-sentry/">
                {t(' What does the script provide?')}
              </ExternalLink>
            ),
          }
        )}
        inline={false}
        flexibleControlStateSize
      >
        <TextCopyInput aria-label={t('Loader Script')}>
          {`<script src='${loaderLink}' crossorigin="anonymous"></script>`}
        </TextCopyInput>

        <HelpFooter>
          {tct(
            'You can [configureLink:configure] the Loader Script to enable/disable Performance, Replay, and more.',
            {
              configureLink: <Link to={editUrl} />,
            }
          )}
        </HelpFooter>
      </FieldGroup>
    </Fragment>
  );
}

const HelpFooter = styled(FieldHelp)`
  margin-top: ${space(1)};
`;
