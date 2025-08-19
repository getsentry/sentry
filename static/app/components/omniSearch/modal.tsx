import {useCallback, useEffect, useRef} from 'react';
import {css} from '@emotion/react';
import exampleAnimationData from 'getsentry-images/omni/mshk-image-to-lottie.json';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import SeeryCharacter from 'sentry/components/omniSearch/animation/seeryCharacter';
import {OmniSearchPalette} from 'sentry/components/omniSearch/palette';
import {useOmniActions} from 'sentry/components/omniSearch/useOmniActions';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';

function OmniSearchModal({Body}: ModalRenderProps) {
  useEffect(
    () =>
      trackAnalytics('omnisearch.open', {
        organization: null,
      }),
    []
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const doBarrelRoll = useCallback(() => {
    const docEl = containerRef.current?.closest(
      "[role='document']"
    ) as HTMLElement | null;
    if (!docEl) {
      return;
    }
    // Trigger animation by toggling a class
    docEl.classList.remove('spinning');
    // Force reflow to restart animation if already applied
    void docEl.offsetWidth;
    docEl.classList.add('spinning');
    // Clean up class after animation ends
    const handleAnimationEnd = () => {
      docEl.classList.remove('spinning');
      docEl.removeEventListener('animationend', handleAnimationEnd);
    };
    docEl.addEventListener('animationend', handleAnimationEnd);
  }, []);

  useOmniActions([
    {
      key: 'barrel-roll',
      label: 'Do a barrel roll! 🛩️',
      details: 'Spin 360 degrees',
      areaKey: 'global',
      section: t('System'),
      actionIcon: undefined,
      hidden: false,
      disabled: false,
      keepOpen: true,
      onAction: () => {
        doBarrelRoll();
      },
    },
  ]);

  return (
    <Body>
      <div ref={containerRef}>
        <SeeryCharacter animationData={exampleAnimationData} />
        <OmniSearchPalette />
      </div>
    </Body>
  );
}

export default OmniSearchModal;

export const modalCss = css`
  [role='document'] {
    padding: 0;
  }

  [role='document'].spinning {
    animation: omni-barrel-roll 1s ease-in-out;
  }

  @keyframes omni-barrel-roll {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
`;
