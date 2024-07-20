import type React from 'react';
import {Fragment} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {space} from 'sentry/styles/space';
import {ChartHeightContext} from 'sentry/views/insights/common/components/chart';

export type InsightChartModalOptions = {
  children: React.ReactNode;
  title: React.ReactNode;
};
type Props = ModalRenderProps & InsightChartModalOptions;

export default function InsightChartModal({Header, title, children}: Props) {
  return (
    <Fragment>
      <Container>
        <Header closeButton>
          <h3>{title}</h3>
        </Header>

        <ChartHeightContext.Provider value={300}>{children}</ChartHeightContext.Provider>
      </Container>
    </Fragment>
  );
}

const Container = styled('div')<{height?: number | null}>`
  height: ${p => (p.height ? `${p.height}px` : 'auto')};
  position: relative;
  padding-bottom: ${space(3)};
`;

export const modalCss = css`
  width: 100%;
  max-width: 1200px;
`;
