import styled from '@emotion/styled';

import {HeaderTitle} from 'sentry/components/charts/styles';
import {Tooltip} from 'sentry/components/tooltip';

export interface TitleTooltipProps {
  title?: string;
}

export function TitleTooltip(props: TitleTooltipProps) {
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
