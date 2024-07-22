import {css} from '@emotion/react';

import {buttonCss} from 'sentry/components/devtoolbar/styles/typography';

import {panelCss, panelHeadingCss, panelSectionCss} from '../styles/panel';
import {resetDialogCss, resetFlexColumnCss} from '../styles/reset';

interface Props {
  title: string;
  children?: React.ReactNode;
  titleLeft?: React.ReactNode;
  titleRight?: React.ReactNode;
  visible?: boolean;
}

export default function PanelLayout({
  children,
  title,
  titleLeft,
  titleRight,
  visible = true,
}: Props) {
  return (
    <dialog
      open
      css={[
        resetDialogCss,
        resetFlexColumnCss,
        panelCss,
        css`
          visibility: ${visible ? 'visible' : 'hidden'};
        `,
      ]}
    >
      {title ? (
        <header css={panelSectionCss}>
          {titleLeft}
          {titleRight}
          <h1 css={[buttonCss, panelHeadingCss]}>{title}</h1>
        </header>
      ) : null}
      <section css={resetFlexColumnCss} style={{contain: 'strict'}}>
        {children}
      </section>
    </dialog>
  );
}
