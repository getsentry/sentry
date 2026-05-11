import styled from '@emotion/styled';

import {Grid} from '@sentry/scraps/layout';
import {Tooltip} from '@sentry/scraps/tooltip';

import {HeaderTitle} from 'sentry/components/charts/styles';

export interface WidgetTitleProps {
  summary?: React.ReactNode;
  title?: string;
}

export function WidgetTitle(props: WidgetTitleProps) {
  const title = (
    <Tooltip title={props.title} containerDisplayMode="grid" showOnlyOnOverflow>
      <TitleText>{props.title}</TitleText>
    </Tooltip>
  );

  return props.summary ? (
    <Grid columns="auto 1fr" gap="lg" height="100%" width="100%">
      {title}
      <SummaryContainer>{props.summary}</SummaryContainer>
    </Grid>
  ) : (
    title
  );
}

const SummaryContainer = styled('div')`
  margin: -${p => p.theme.space.xl} 0;
`;

const TitleText = styled(HeaderTitle)`
  display: block;
  width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-weight: ${p => p.theme.font.weight.sans.medium};
`;
