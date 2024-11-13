import Submenu, {SubmenuBody, SubmenuItem} from 'sentry/components/nav/submenu';
import useOrganization from 'sentry/utils/useOrganization';
import {
  AI_LANDING_SUB_PATH,
  AI_LANDING_TITLE,
} from 'sentry/views/insights/pages/ai/settings';
import {
  BACKEND_LANDING_SUB_PATH,
  BACKEND_LANDING_TITLE,
} from 'sentry/views/insights/pages/backend/settings';
import {
  FRONTEND_LANDING_SUB_PATH,
  FRONTEND_LANDING_TITLE,
} from 'sentry/views/insights/pages/frontend/settings';
import {
  MOBILE_LANDING_SUB_PATH,
  MOBILE_LANDING_TITLE,
} from 'sentry/views/insights/pages/mobile/settings';
import {DOMAIN_VIEW_BASE_URL} from 'sentry/views/insights/pages/settings';

export default function PerformanceSubmenu() {
  const organization = useOrganization();
  const prefix = `organizations/${organization.slug}/${DOMAIN_VIEW_BASE_URL}`;

  return (
    <Submenu>
      <SubmenuBody>
        <SubmenuItem
          id={FRONTEND_LANDING_SUB_PATH}
          to={`/${prefix}/${FRONTEND_LANDING_SUB_PATH}`}
        >
          {FRONTEND_LANDING_TITLE}
        </SubmenuItem>
        <SubmenuItem
          id={BACKEND_LANDING_SUB_PATH}
          to={`/${prefix}/${BACKEND_LANDING_SUB_PATH}`}
        >
          {BACKEND_LANDING_TITLE}
        </SubmenuItem>
        <SubmenuItem id={AI_LANDING_SUB_PATH} to={`/${prefix}/${AI_LANDING_SUB_PATH}`}>
          {AI_LANDING_TITLE}
        </SubmenuItem>
        <SubmenuItem
          id={MOBILE_LANDING_SUB_PATH}
          to={`/${prefix}/${MOBILE_LANDING_SUB_PATH}`}
        >
          {MOBILE_LANDING_TITLE}
        </SubmenuItem>
      </SubmenuBody>
    </Submenu>
  );
}
