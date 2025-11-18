import {Fragment} from 'react';
import {Outlet, useMatches} from 'react-router-dom';

import {PageHeadingQuestionTooltip} from 'sentry/components/pageHeadingQuestionTooltip';
import useCrossPlatformProject from 'sentry/views/insights/mobile/common/queries/useCrossPlatformProject';
import {PlatformSelector} from 'sentry/views/insights/mobile/screenload/components/platformSelector';
import {
  MODULE_DESCRIPTION,
  MODULE_DOC_LINK,
  MODULE_TITLE,
} from 'sentry/views/insights/mobile/screens/settings';
import {MobileHeader} from 'sentry/views/insights/pages/mobile/mobilePageHeader';
import {ModuleName} from 'sentry/views/insights/types';

function MobileVitalsHeader() {
  const {isProjectCrossPlatform} = useCrossPlatformProject();

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
      headerActions={isProjectCrossPlatform && <PlatformSelector />}
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
