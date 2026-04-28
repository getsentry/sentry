import styled from '@emotion/styled';

import {HeaderTitleLegend as _HeaderTitleLegend} from 'sentry/components/charts/styles';
import {Panel} from 'sentry/components/panels/panel';
import {defined} from 'sentry/utils';

export const WidgetContainer = styled(Panel)<{height?: string}>`
  ${p => defined(p.height) && `height: ${p.height};`}
  display: flex;
  flex-direction: column;
  padding-top: ${p => p.theme.space.xl};
`;

export const HeaderContainer = styled('div')`
  display: grid;
  grid-auto-flow: column;
  grid-template-columns: 1fr auto;
  grid-template-rows: 26px auto;
  padding-left: ${p => p.theme.space.xl};
  padding-right: ${p => p.theme.space.xl};
`;

export const HeaderTitleLegend = styled(_HeaderTitleLegend)`
  position: relative;
`;

export const Subtitle = styled('div')`
  color: ${p => p.theme.tokens.content.secondary};
  font-size: ${p => p.theme.font.size.md};
  display: inline-block;
`;

export const StatusContainer = styled('div')`
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1 1 auto;

  .loading {
    margin: 0 auto;
  }
`;

export const Accordion = styled('ul')`
  display: flex;
  flex-direction: column;
  padding: ${p => p.theme.space.md} 0 0 0;
  margin: 0;
  list-style-type: none;
  flex: 1 1 auto;
`;

export const AccordionItem = styled('li')`
  display: grid;
  grid-template-columns: auto auto 1fr auto auto;
  line-height: ${p => p.theme.font.lineHeight.comfortable};
  align-items: center;
  gap: ${p => p.theme.space.md};
  border-top: 1px solid ${p => p.theme.tokens.border.primary};
  padding: ${p => p.theme.space.xs} ${p => p.theme.space.xl};
  font-size: ${p => p.theme.font.size.md};
  min-height: 35px;
`;
