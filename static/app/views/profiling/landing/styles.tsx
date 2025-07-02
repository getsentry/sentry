import styled from '@emotion/styled';

import {HeaderTitleLegend as _HeaderTitleLegend} from 'sentry/components/charts/styles';
import {Text} from 'sentry/components/core/text';
import Panel from 'sentry/components/panels/panel';
import {space} from 'sentry/styles/space';
import {defined} from 'sentry/utils';

export const WidgetContainer = styled(Panel)<{height?: string}>`
  ${p => defined(p.height) && `height: ${p.height};`}
  display: flex;
  flex-direction: column;
  padding-top: ${space(2)};
`;

export const HeaderContainer = styled('div')`
  display: grid;
  grid-auto-flow: column;
  grid-template-columns: 1fr auto;
  grid-template-rows: 26px auto;
  padding-left: ${space(2)};
  padding-right: ${space(2)};
`;

export const HeaderTitleLegend = styled(_HeaderTitleLegend)`
  position: relative;
`;

export function Subtitle({children}: {children: React.ReactNode}) {
  return (
    <Text variant="muted" size="md">
      {children}
    </Text>
  );
}

export const ContentContainer = styled('div')`
  flex: 1 1 auto;

  display: flex;
  flex-direction: column;
  justify-content: center;
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
  padding: ${space(1)} 0 0 0;
  margin: 0;
  list-style-type: none;
  flex: 1 1 auto;
`;

export const AccordionItem = styled('li')`
  display: grid;
  grid-template-columns: auto auto 1fr auto auto;
  line-height: ${p => p.theme.text.lineHeightBody};
  align-items: center;
  gap: ${space(1)};
  border-top: 1px solid ${p => p.theme.border};
  padding: ${space(0.5)} ${space(2)};
  font-size: ${p => p.theme.fontSize.md};
  min-height: 35px;
`;
