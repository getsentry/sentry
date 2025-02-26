import * as Layout from 'sentry/components/layouts/thirds';
import {usePrefersStackedNav} from 'sentry/components/nav/prefersStackedNav';
import {PageHeadingQuestionTooltip} from 'sentry/components/pageHeadingQuestionTooltip';
import {t} from 'sentry/locale';

function Header() {
  const prefersStackedNav = usePrefersStackedNav();

  return (
    <Layout.Header noActionWrap unified={prefersStackedNav}>
      <Layout.HeaderContent unified={prefersStackedNav}>
        <Layout.Title>
          {t('Releases')}
          <PageHeadingQuestionTooltip
            docsUrl="https://docs.sentry.io/product/releases/"
            title={t(
              'A visualization of your release adoption from the past 24 hours, providing a high-level view of the adoption stage, percentage of crash-free users and sessions, and more.'
            )}
          />
        </Layout.Title>
      </Layout.HeaderContent>
    </Layout.Header>
  );
}

export default Header;
