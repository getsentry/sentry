import type {ReactNode} from 'react';
import styled from '@emotion/styled';

import {HeaderTitle} from 'sentry/components/charts/styles';
import {Tooltip} from 'sentry/components/tooltip';

export interface WidgetTitleProps {
  interactiveTitle?: () => ReactNode;
  title?: string;
}

export function WidgetTitle(props: WidgetTitleProps) {
  if (props.interactiveTitle) {
    return props.interactiveTitle();
  }

  return (
    <Tooltip title={props.title} containerDisplayMode="grid" showOnlyOnOverflow>
      <TitleText>{props.title}</TitleText>
    </Tooltip>
  );
}

const TitleText = styled(HeaderTitle)`
  ${p => p.theme.overflowEllipsis};
  font-weight: ${p => p.theme.fontWeightBold};
`;
