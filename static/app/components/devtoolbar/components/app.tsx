import {Fragment, Suspense} from 'react';
import {Global} from '@emotion/react';

import LoadingTriangle from 'sentry/components/loadingTriangle';
import {useSessionStorage} from 'sentry/utils/useSessionStorage';

import usePlacementCss from '../hooks/usePlacementCss';
import {fixedContainerBaseCss} from '../styles/fixedContainer';
import {avatarCss, globalCss, loadingIndicatorCss} from '../styles/global';
import {resetFlexColumnCss} from '../styles/reset';

import Navigation from './navigation';
import PanelLayout from './panelLayout';
import PanelRouter from './panelRouter';

export default function App() {
  const placement = usePlacementCss();
  const [isHidden, setIsHidden] = useSessionStorage('hide_employee_devtoolbar', false);
  if (isHidden) {
    return null;
  }

  return (
    <Fragment>
      <Global styles={globalCss} />
      <Global styles={loadingIndicatorCss} />
      <Global styles={avatarCss} />
      <div css={[fixedContainerBaseCss, placement.fixedContainer.css]}>
        {isHidden ? null : (
          <Fragment>
            <Navigation setIsHidden={setIsHidden} />
            <Suspense fallback={<LoadingPanel />}>
              <PanelRouter />
            </Suspense>
          </Fragment>
        )}
      </div>
    </Fragment>
  );
}

function LoadingPanel() {
  return (
    <PanelLayout title="">
      <div css={resetFlexColumnCss} style={{overflow: 'hidden', contain: 'strict'}}>
        <LoadingTriangle />
      </div>
    </PanelLayout>
  );
}
