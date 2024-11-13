import Submenu, {SubmenuBody, SubmenuItem} from 'sentry/components/nav/submenu';
import {t} from 'sentry/locale';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';

export type IssuesSubmenuKey =
  | 'all'
  | 'error'
  | 'trend'
  | 'craftsmanship'
  | 'security'
  | 'feedback';

export default function IssuesSubmenu() {
  const organization = useOrganization();
  const location = useLocation();
  const prefix = `organizations/${organization.slug}`;
  const defaultPathname = `/${prefix}/issues/`;

  return (
    <Submenu>
      <SubmenuBody>
        <SubmenuItem
          id="all"
          to={{...location, pathname: defaultPathname, state: {issueTaxonomy: 'all'}}}
        >
          {t('All')}
        </SubmenuItem>
        <SubmenuItem
          id="error"
          to={{...location, pathname: defaultPathname, state: {issueTaxonomy: 'error'}}}
        >
          {t('Error & Outage')}
        </SubmenuItem>
        <SubmenuItem
          id="trend"
          to={{...location, pathname: defaultPathname, state: {issueTaxonomy: 'trend'}}}
        >
          {t('Trend')}
        </SubmenuItem>
        <SubmenuItem
          id="craftsmanship"
          to={{
            ...location,
            pathname: defaultPathname,
            state: {issueTaxonomy: 'craftsmanship'},
          }}
        >
          {t('Craftsmanship')}
        </SubmenuItem>
        <SubmenuItem
          id="security"
          to={{
            ...location,
            pathname: defaultPathname,
            state: {issueTaxonomy: 'security'},
          }}
        >
          {t('Security')}
        </SubmenuItem>
        <SubmenuItem id="feedback" to={`/${prefix}/feedback/`}>
          {t('Feedback')}
        </SubmenuItem>
      </SubmenuBody>
    </Submenu>
  );
}
