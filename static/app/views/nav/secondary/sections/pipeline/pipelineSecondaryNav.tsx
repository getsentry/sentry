import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';
import {PRIMARY_NAV_GROUP_CONFIG} from 'sentry/views/nav/primary/config';
import {SecondaryNav} from 'sentry/views/nav/secondary/secondary';
import {PrimaryNavGroup} from 'sentry/views/nav/types';
import {makePipelinePathname} from 'sentry/views/pipeline/pathnames';
import {COVERAGE_BASE_URL, TESTS_BASE_URL} from 'sentry/views/pipeline/settings';

function PipelineSecondaryNav() {
  const organization = useOrganization();
  const coveragePathname = makePipelinePathname({
    organization,
    path: `/${COVERAGE_BASE_URL}/`,
  });
  const testsPathname = makePipelinePathname({
    organization,
    path: `/${TESTS_BASE_URL}/`,
  });

  return (
    <SecondaryNav>
      <SecondaryNav.Header>
        {PRIMARY_NAV_GROUP_CONFIG[PrimaryNavGroup.PIPELINE].label}
      </SecondaryNav.Header>
      <SecondaryNav.Body>
        <SecondaryNav.Section>
          <SecondaryNav.Item to={coveragePathname}>{t('Coverage')}</SecondaryNav.Item>
          <SecondaryNav.Item to={testsPathname}>{t('Tests')}</SecondaryNav.Item>
        </SecondaryNav.Section>
      </SecondaryNav.Body>
    </SecondaryNav>
  );
}

export default PipelineSecondaryNav;
