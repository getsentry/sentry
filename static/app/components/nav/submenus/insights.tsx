import Feature from 'sentry/components/acl/feature';
import Submenu, {SubmenuBody, SubmenuItem} from 'sentry/components/nav/submenu';
import useOrganization from 'sentry/utils/useOrganization';
import {MODULE_BASE_URLS} from 'sentry/views/insights/common/utils/useModuleURL';
import {MODULE_SIDEBAR_TITLE as MODULE_TITLE_HTTP} from 'sentry/views/insights/http/settings';
import {INSIGHTS_BASE_URL, MODULE_TITLES} from 'sentry/views/insights/settings';

export type InsightsSubmenuKey =
  | 'all'
  | 'error'
  | 'trend'
  | 'craftsmanship'
  | 'security'
  | 'feedback';

export default function InsightsSubmenu() {
  const {slug} = useOrganization();
  const prefix = `organizations/${slug}/${INSIGHTS_BASE_URL}`;

  return (
    <Submenu>
      <SubmenuBody>
        <SubmenuItem
          id={MODULE_BASE_URLS.http}
          to={`/${prefix}/${MODULE_BASE_URLS.http}`}
        >
          {MODULE_TITLE_HTTP}
        </SubmenuItem>
        <SubmenuItem id={MODULE_BASE_URLS.db} to={`/${prefix}/${MODULE_BASE_URLS.db}`}>
          {MODULE_TITLES.db}
        </SubmenuItem>
        <SubmenuItem
          id={MODULE_BASE_URLS.resource}
          to={`/${prefix}/${MODULE_BASE_URLS.resource}`}
        >
          {MODULE_TITLES.resource}
        </SubmenuItem>
        <SubmenuItem
          id={MODULE_BASE_URLS.app_start}
          to={`/${prefix}/${MODULE_BASE_URLS.app_start}`}
        >
          {MODULE_TITLES.app_start}
        </SubmenuItem>
        <SubmenuItem
          id={MODULE_BASE_URLS.vital}
          to={`/${prefix}/${MODULE_BASE_URLS.vital}`}
        >
          {MODULE_TITLES.vital}
        </SubmenuItem>
        <Feature features="insights-mobile-screens-module">
          <SubmenuItem
            id={MODULE_BASE_URLS['mobile-screens']}
            to={`/${prefix}/${MODULE_BASE_URLS['mobile-screens']}/`}
          >
            {MODULE_TITLES['mobile-screens']}
          </SubmenuItem>
        </Feature>
        <SubmenuItem
          id={MODULE_BASE_URLS.cache}
          to={`/${prefix}/${MODULE_BASE_URLS.cache}`}
        >
          {MODULE_TITLES.cache}
        </SubmenuItem>
        <SubmenuItem
          id={MODULE_BASE_URLS.queue}
          to={`/${prefix}/${MODULE_BASE_URLS.queue}`}
        >
          {MODULE_TITLES.queue}
        </SubmenuItem>
        <SubmenuItem id={MODULE_BASE_URLS.ai} to={`/${prefix}/${MODULE_BASE_URLS.ai}`}>
          {MODULE_TITLES.ai}
        </SubmenuItem>
      </SubmenuBody>
    </Submenu>
  );
}
