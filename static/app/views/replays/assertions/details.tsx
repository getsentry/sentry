import {Breadcrumbs} from 'sentry/components/breadcrumbs';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import FullViewport from 'sentry/components/layouts/fullViewport';
import * as Layout from 'sentry/components/layouts/thirds';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {makeReplaysPathname} from 'sentry/views/replays/pathnames';

export default function ReplayAssertionDetails() {
  const organization = useOrganization();
  const {assertionSlug} = useParams();

  const crumbs = [
    {
      label: t('Replay'),
      to: {
        pathname: makeReplaysPathname({
          path: '/',
          organization,
        }),
      },
    },
    {
      label: t('Assertions'),
      to: {
        pathname: makeReplaysPathname({
          path: '/assertions/table/',
          organization,
        }),
      },
    },
    {
      label: assertionSlug,
    },
  ];

  return (
    <SentryDocumentTitle title={t('Assertion %s', assertionSlug)}>
      <FullViewport>
        <Layout.Header>
          <Layout.HeaderContent>
            <Breadcrumbs crumbs={crumbs} />
          </Layout.HeaderContent>
          <Layout.HeaderActions>
            <LinkButton
              priority="primary"
              to={makeReplaysPathname({
                path: '/assertions/new/',
                organization,
              })}
            >
              Save
            </LinkButton>
          </Layout.HeaderActions>
        </Layout.Header>
      </FullViewport>
    </SentryDocumentTitle>
  );
}
