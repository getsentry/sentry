import {Fragment, type ReactNode} from 'react';
import styled from '@emotion/styled';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';

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
      <Body>{children}</Body>
    </Fragment>
  );
}

export const CodeBlockWrapper = styled('div')`
  max-height: 300px;
  overflow: auto;
  min-width: 0;
  width: 100%;
  padding: ${p => p.theme.space.sm} 0;
`;

export const InlineCode = styled('code')`
  background: ${p => p.theme.backgroundSecondary};
  padding: ${p => p.theme.space.xs} ${p => p.theme.space.sm};
  border-radius: ${p => p.theme.radius.md};
  font-family: ${p => p.theme.text.familyMono};
  font-size: ${p => p.theme.fontSize.sm};
  color: ${p => p.theme.colors.blue400};
`;
