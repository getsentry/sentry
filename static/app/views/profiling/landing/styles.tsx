import styled from '@emotion/styled';

import {HeaderTitleLegend as _HeaderTitleLegend} from 'sentry/components/charts/styles';
import {Flex} from 'sentry/components/core/layout';
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

export const Subtitle = styled('div')`
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSize.md};
  display: inline-block;
`;

export function ContentContainer({children}: {children: React.ReactNode}) {
  return (
    <Flex flex="1 1 auto" direction="column" justify="center">
      {children}
    </Flex>
  );
}

export function StatusContainer({children}: {children: React.ReactNode}) {
  return (
    <Flex align="center" justify="center" flex="1 1 auto">
      {children}
    </Flex>
  );
}

export const Accordion = styled(Flex)`
  padding: ${space(1)} 0 0 0;
  margin: 0;
  list-style-type: none;
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
