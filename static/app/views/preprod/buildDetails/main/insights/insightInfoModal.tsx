import {Fragment, type ReactNode} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {space} from 'sentry/styles/space';

type InsightInfoModalOptions = {
  children: ReactNode;
  title: string;
};

type Props = ModalRenderProps & InsightInfoModalOptions;

export function InsightInfoModal({Header, Body, title, children}: Props) {
  return (
    <Fragment>
      <Header closeButton>
        <h3>{title}</h3>
      </Header>
      <Body>
        <ContentWrapper>{children}</ContentWrapper>
      </Body>
    </Fragment>
  );
}

const ContentWrapper = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(3)};
  min-width: 0;
`;

export const modalCss = css`
  width: 90%;
  max-width: 700px;
`;

export const CodeBlockWrapper = styled('div')`
  max-height: 300px;
  overflow: auto;
  min-width: 0;
  width: 100%;
  padding: ${p => p.theme.space.sm} 0;
`;

export const Code = styled('code')`
  background: ${p => p.theme.backgroundSecondary};
  padding: ${p => p.theme.space.xs} ${p => p.theme.space.sm};
  border-radius: ${p => p.theme.borderRadius};
  font-family: ${p => p.theme.text.familyMono};
  font-size: ${p => p.theme.fontSize.sm};
  color: ${p => p.theme.purple300};
`;

export const OrderedList = styled('ol')`
  margin: 0;
  padding-left: ${p => p.theme.space.xl};
  display: flex;
  flex-direction: column;
  gap: ${p => p.theme.space.sm};

  li {
    color: ${p => p.theme.textColor};
  }
`;
