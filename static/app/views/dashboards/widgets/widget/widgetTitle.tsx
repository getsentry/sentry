import styled from '@emotion/styled';

import {Tooltip} from '@sentry/scraps/tooltip';

import {HeaderTitle} from 'sentry/components/charts/styles';

export interface WidgetTitleProps {
  title?: string;
}

export function WidgetTitle(props: WidgetTitleProps) {
  return (
    <Tooltip title={props.title} containerDisplayMode="grid" showOnlyOnOverflow>
      <TitleText>{props.title}</TitleText>
    </Tooltip>
  );
}

const TitleText = styled(HeaderTitle)`
  display: block;
  width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-weight: ${p => p.theme.font.weight.sans.medium};
`;
