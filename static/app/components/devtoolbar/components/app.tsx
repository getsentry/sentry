import {Fragment, Suspense} from 'react';
import {Global} from '@emotion/react';

import LoadingTriangle from 'sentry/components/loadingTriangle';
import {useSessionStorage} from 'sentry/utils/useSessionStorage';

import usePlacementCss from '../hooks/usePlacementCss';
import useVisibility from '../hooks/useVisibility';
import {fixedContainerBaseCss} from '../styles/fixedContainer';
import {avatarCss, globalCss, loadingIndicatorCss} from '../styles/global';
import {radixUiGlobalCss} from '../styles/radixUiGlobal';
import {resetFlexColumnCss} from '../styles/reset';

import Navigation from './navigation';
import PanelLayout from './panelLayout';
import PanelRouter from './panelRouter';

export default function App() {
  const placement = usePlacementCss();
  const [visibility] = useVisibility();
  const [isDisabled, setIsDisabled] = useSessionStorage(
    'hide_employee_devtoolbar',
    false
  );
  if (isDisabled) {
    return null;
  }

  return (
    <Fragment>
      <Global styles={globalCss} />
      <Global styles={loadingIndicatorCss} />
      <Global styles={avatarCss} />
      <Global styles={radixUiGlobalCss} />
      <div css={[fixedContainerBaseCss, placement.fixedContainer.css, {visibility}]}>
        {isDisabled ? null : (
          <Fragment>
            <Navigation setIsDisabled={setIsDisabled} />
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
