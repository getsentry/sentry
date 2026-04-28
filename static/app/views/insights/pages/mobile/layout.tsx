import {Fragment} from 'react';
import {Outlet, useMatches} from 'react-router-dom';

import {PageHeadingQuestionTooltip} from 'sentry/components/pageHeadingQuestionTooltip';
import {
  MODULE_DESCRIPTION,
  MODULE_DOC_LINK,
  MODULE_TITLE,
} from 'sentry/views/insights/mobile/screens/settings';
import {MobileHeader} from 'sentry/views/insights/pages/mobile/mobilePageHeader';
import {ModuleName} from 'sentry/views/insights/types';

function MobileVitalsHeader() {
  return (
    <MobileHeader
      headerTitle={
        <Fragment>
          {MODULE_TITLE}
          <PageHeadingQuestionTooltip
            docsUrl={MODULE_DOC_LINK}
            title={MODULE_DESCRIPTION}
          />
        </Fragment>
      }
      module={ModuleName.MOBILE_VITALS}
    />
  );
}

function MobileLayout() {
  const handle = useMatches().at(-1)?.handle as {module?: ModuleName} | undefined;

  return (
    <Fragment>
      {handle && 'module' in handle ? (
        handle.module === ModuleName.MOBILE_VITALS ? (
          <MobileVitalsHeader />
        ) : (
          <MobileHeader module={handle.module} />
        )
      ) : null}
      <Outlet />
    </Fragment>
  );
}

export default MobileLayout;
