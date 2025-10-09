import type React from 'react';
import {Fragment} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {space} from 'sentry/styles/space';
import {ChartRenderingContext} from 'sentry/views/insights/common/components/chart';

export type InsightChartModalOptions = {
  children: React.ReactNode;
  title: React.ReactNode;
  footer?: React.ReactNode;
  fullscreen?: boolean;
  height?: number;
};
type Props = ModalRenderProps & InsightChartModalOptions;

export default function InsightChartModal({
  Header,
  title,
  children,
  Footer,
  footer,
  fullscreen = false,
  height = 300,
}: Props) {
  return (
    <Fragment>
      <Container fullscreen={fullscreen}>
        <Header closeButton>
          <h3>{title}</h3>
        </Header>

        <ContentArea fullscreen={fullscreen}>
          <ChartRenderingContext value={{height, isFullscreen: true}}>
            {children}
          </ChartRenderingContext>
        </ContentArea>

        {footer && <Footer>{footer}</Footer>}
      </Container>
    </Fragment>
  );
}

const Container = styled('div')<{fullscreen?: boolean; height?: number | null}>`
  height: ${p =>
    p.fullscreen ? 'calc(100vh - 80px)' : p.height ? `${p.height}px` : 'auto'};
  position: relative;
  padding-bottom: ${space(3)};
  z-index: 1000;
  display: flex;
  flex-direction: column;
`;

const ContentArea = styled('div')<{fullscreen?: boolean}>`
  ${p =>
    p.fullscreen &&
    `
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  `}
`;

export const modalCss = css`
  width: 100%;
  max-width: 1200px;
`;

export const fullscreenModalCss = css`
  width: calc(100vw - 80px);
  height: calc(100vh - 80px);
  max-width: calc(100vw - 80px);
  max-height: calc(100vh - 80px);

  [role='document'] {
    height: 100%;
    display: flex;
    flex-direction: column;
  }
`;
