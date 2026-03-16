import {Navigate, useLocation} from 'react-router-dom';

import {CONVERSATIONS_LANDING_SUB_PATH} from 'sentry/views/insights/pages/conversations/settings';

export default function ConversationsRedirect() {
  const location = useLocation();
  return (
    <Navigate
      to={`/explore/${CONVERSATIONS_LANDING_SUB_PATH}/${location.search}`}
      replace
    />
  );
}
