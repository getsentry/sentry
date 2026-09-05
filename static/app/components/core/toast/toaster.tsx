import type {ReactNode} from 'react';
import {Fragment} from 'react';
import styled from '@emotion/styled';
import {Toaster} from 'sonner';

import {useTranslation} from '@sentry/scraps/translationContext';

import {DEFAULT_TOAST_DURATION} from './types';

const StyledToaster = styled(Toaster)`
  &[data-sonner-toaster] {
    z-index: ${p => p.theme.zIndex.toast};
    width: auto;
  }

  &[data-sonner-toaster] [data-sonner-toast] {
    width: auto;
    max-width: min(600px, calc(100vw - 60px));
  }
`;

export function ToastProvider({children}: {children?: ReactNode}) {
  const {t} = useTranslation();

  return (
    <Fragment>
      {children}
      <StyledToaster
        position="bottom-right"
        offset={{bottom: '30px', right: 'calc(30px + var(--scrollbar-size, 0px))'}}
        duration={DEFAULT_TOAST_DURATION}
        gap={12}
        visibleToasts={3}
        containerAriaLabel={t('Notifications')}
      />
    </Fragment>
  );
}
