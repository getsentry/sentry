import {buttonCss} from 'sentry/components/devtoolbar/styles/typography';

import {panelCss, panelHeadingCss, panelSectionCss} from '../styles/panel';
import {resetDialogCss, resetFlexColumnCss} from '../styles/reset';

interface Props {
  title: string;
  children?: React.ReactNode;
  titleLeft?: React.ReactNode;
  titleRight?: React.ReactNode;
}

export default function PanelLayout({children, title, titleLeft, titleRight}: Props) {
  return (
    <dialog open css={[resetDialogCss, resetFlexColumnCss, panelCss]}>
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
