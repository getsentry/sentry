import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';
import {makeCodecovPathname} from 'sentry/views/codecov/pathnames';
import {COVERAGE_BASE_URL, TESTS_BASE_URL} from 'sentry/views/codecov/settings';
import {PRIMARY_NAV_GROUP_CONFIG} from 'sentry/views/nav/primary/config';
import {SecondaryNav} from 'sentry/views/nav/secondary/secondary';
import {PrimaryNavGroup} from 'sentry/views/nav/types';

function CodecovSecondaryNav() {
  const organization = useOrganization();
  const coveragePathname = makeCodecovPathname({
    organization,
    path: `/${COVERAGE_BASE_URL}/`,
  });
  const testsPathname = makeCodecovPathname({
    organization,
    path: `/${TESTS_BASE_URL}/`,
  });

  return (
    <SecondaryNav>
      <SecondaryNav.Header>
        {PRIMARY_NAV_GROUP_CONFIG[PrimaryNavGroup.CODECOV].label}
      </SecondaryNav.Header>
      <SecondaryNav.Body>
        <SecondaryNav.Section>
          <SecondaryNav.Item
            to={`${coveragePathname}commits/`}
            activeTo={coveragePathname}
          >
            {t('Coverage')}
          </SecondaryNav.Item>
          <SecondaryNav.Item to={testsPathname} activeTo={testsPathname}>
            {t('Tests')}
          </SecondaryNav.Item>
        </SecondaryNav.Section>
      </SecondaryNav.Body>
    </SecondaryNav>
  );
}

export default CodecovSecondaryNav;
