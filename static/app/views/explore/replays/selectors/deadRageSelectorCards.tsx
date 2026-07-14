import type {ReactNode} from 'react';
import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import {Container, Flex, Stack, type FlexProps} from '@sentry/scraps/layout';

import {Accordion} from 'sentry/components/container/accordion';
import {EmptyStateWarning} from 'sentry/components/emptyStateWarning';
import {Placeholder} from 'sentry/components/placeholder';
import {QuestionTooltip} from 'sentry/components/questionTooltip';
import {TextOverflow} from 'sentry/components/textOverflow';
import {IconCursorArrow, IconSearch} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {useDeadRageSelectors} from 'sentry/utils/replays/hooks/useDeadRageSelectors';
import {useLocation} from 'sentry/utils/useLocation';
import {
  HeaderContainer,
  HeaderTitleLegend,
  Subtitle,
  WidgetContainer,
} from 'sentry/views/explore/profiling/landing/styles';
import {ExampleReplaysList} from 'sentry/views/explore/replays/selectors/exampleReplaysList';
import {ProjectInfo} from 'sentry/views/explore/replays/selectors/projectInfo';
import {SelectorLink} from 'sentry/views/explore/replays/selectors/selectorLink';
import {transformSelectorQuery} from 'sentry/views/explore/replays/selectors/utils';

type ClickType = 'count_dead_clicks' | 'count_rage_clicks';
type DeadOrRage = 'dead' | 'rage';

export function DeadRageSelectorCards() {
  return (
    <SplitCardContainer>
      <AccordionWidget clickType="count_dead_clicks" deadOrRage="dead" />
      <AccordionWidget clickType="count_rage_clicks" deadOrRage="rage" />
    </SplitCardContainer>
  );
}

export function DeadRageSelectorCardsPlaceholder() {
  return (
    <SplitCardContainer>
      <WidgetFrame deadOrRage="dead">
        <SelectorCardPlaceholder />
      </WidgetFrame>
      <WidgetFrame deadOrRage="rage">
        <SelectorCardPlaceholder />
      </WidgetFrame>
    </SplitCardContainer>
  );
}

function AccordionWidget({
  clickType,
  deadOrRage,
}: {
  clickType: ClickType;
  deadOrRage: DeadOrRage;
}) {
  const clickVariant = deadOrRage === 'dead' ? 'warning' : 'danger';
  const [selectedListIndex, setSelectListIndex] = useState(-1);
  const {isLoading, isError, data} = useDeadRageSelectors({
    per_page: 3,
    sort: `-${clickType}`,
    cursor: undefined,
    prefix: 'selector_',
    isWidgetData: true,
  });
  const location = useLocation();
  const filteredData = data.filter(d => (d[clickType] ?? 0) > 0);

  return (
    <WidgetFrame deadOrRage={deadOrRage}>
      {isLoading ? (
        <SelectorCardPlaceholder />
      ) : isError || (!isLoading && filteredData.length === 0) ? (
        <Stack flex="1 1 auto" justify="center">
          <StyledEmptyStateWarning withIcon={false}>
            <EmptyHeader>
              <IconSearch size="sm" />
              {t('No results found')}
            </EmptyHeader>
            <EmptySubtitle>
              {tct(
                'There were no [type] clicks within this timeframe. Expand your timeframe, or increase your replay sample rate to see more data.',
                {type: deadOrRage}
              )}
            </EmptySubtitle>
          </StyledEmptyStateWarning>
        </Stack>
      ) : (
        <Stack flex="1 1 auto" justify="start">
          <Accordion
            collapsible
            collapsedChevronDirection="right"
            expandedIndex={selectedListIndex}
            expandedChevronDirection="down"
            setExpandedIndex={setSelectListIndex}
            items={filteredData.map(d => {
              const selectorQuery = `${deadOrRage}.selector:"${transformSelectorQuery(
                d.dom_element.fullSelector
              )}"`;
              return {
                header: (
                  <AccordionItemHeader
                    count={d[clickType] ?? 0}
                    selector={d.dom_element.selector}
                    clickVariant={clickVariant}
                    selectorQuery={selectorQuery}
                    id={d.project_id}
                  />
                ),
                content: (
                  <ExampleReplaysList
                    location={location}
                    clickType={clickType}
                    selectorQuery={selectorQuery}
                    projectId={d.project_id}
                  />
                ),
              };
            })}
          />
        </Stack>
      )}
    </WidgetFrame>
  );
}

function WidgetFrame({
  children,
  deadOrRage,
}: {
  children: ReactNode;
  deadOrRage: DeadOrRage;
}) {
  const clickVariant = deadOrRage === 'dead' ? 'warning' : 'danger';

  return (
    <StyledWidgetContainer data-test-id="selector-widget">
      <StyledHeaderContainer>
        <IconCursorArrow variant={clickVariant} />
        <SelectorCardHeader deadOrRage={deadOrRage} />
      </StyledHeaderContainer>
      {children}
    </StyledWidgetContainer>
  );
}

function SelectorCardHeader({deadOrRage}: {deadOrRage: DeadOrRage}) {
  return (
    <div>
      <StyledWidgetHeader>
        <Flex align="center" gap="md">
          {deadOrRage === 'dead' ? t('Most Dead Clicks') : t('Most Rage Clicks')}
          <QuestionTooltip
            size="xs"
            position="top"
            title={
              deadOrRage === 'dead'
                ? t(
                    'The top selectors your users have dead clicked on (i.e., a user click that does not result in any page activity after 7 seconds).'
                  )
                : t(
                    'The top selectors your users have rage clicked on (i.e., 5 or more clicks on a dead element, which exhibits no page activity after 7 seconds).'
                  )
            }
            isHoverable
          />
        </Flex>
      </StyledWidgetHeader>
      <Subtitle>{t('Suggested replays to watch')}</Subtitle>
    </div>
  );
}

function SelectorCardPlaceholder() {
  return (
    <Fragment>
      <Container paddingTop="md" />
      <LoadingContainer borderTop="muted">
        <Stack gap="xs">
          <Placeholder style={{height: '32px'}} />
          <Placeholder style={{height: '32px'}} />
          <Placeholder style={{height: '32px'}} />
        </Stack>
      </LoadingContainer>
    </Fragment>
  );
}

function AccordionItemHeader({
  count,
  clickVariant,
  selector,
  selectorQuery,
  id,
}: {
  clickVariant: 'warning' | 'danger';
  count: number;
  id: number;
  selector: string;
  selectorQuery: string;
}) {
  const clickCount = (
    <ClickCount>
      <IconCursorArrow size="xs" variant={clickVariant} />
      {count}
    </ClickCount>
  );
  return (
    <StyledAccordionHeader>
      <SelectorLink
        value={selector}
        selectorQuery={selectorQuery}
        projectId={id.toString()}
      />
      <RightAlignedCell>
        {clickCount}
        <ProjectInfo id={id} isWidget />
      </RightAlignedCell>
    </StyledAccordionHeader>
  );
}

const SplitCardContainer = styled('div')`
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: max-content;
  grid-auto-flow: column;
  gap: 0 ${p => p.theme.space.xl};
  align-items: stretch;
`;

const ClickCount = styled(TextOverflow)`
  color: ${p => p.theme.colors.gray500};
  display: grid;
  grid-template-columns: auto auto;
  gap: ${p => p.theme.space.sm};
  align-items: center;
`;

const StyledHeaderContainer = styled(HeaderContainer)`
  grid-auto-flow: row;
  align-items: center;
  grid-template-rows: auto;
  grid-template-columns: 30px auto;
`;

const StyledAccordionHeader = styled('div')`
  display: grid;
  grid-template-columns: 1fr max-content;
  flex: 1;
  padding: ${p => p.theme.space['2xs']};
  align-items: center;
`;

const StyledWidgetHeader = styled(HeaderTitleLegend)`
  display: grid;
  justify-content: space-between;
  align-items: center;
`;

const StyledWidgetContainer = styled(WidgetContainer)`
  margin-bottom: 0;
  padding-top: ${p => p.theme.space.lg};
`;

export const RightAlignedCell = styled('div')`
  text-align: right;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: ${p => p.theme.space.md};
  padding-left: ${p => p.theme.space.md};
`;

const EmptySubtitle = styled('div')`
  font-size: ${p => p.theme.font.size.md};
  line-height: 1.6em;
  padding-left: ${p => p.theme.space.md};
  padding-right: ${p => p.theme.space.md};
`;

const LoadingContainer = styled((props: FlexProps) => (
  <Stack gap="2xs" flex="1 1 auto" justify="start" {...props} />
))`
  padding: ${p => p.theme.space.md} ${p => p.theme.space.xs} 4px ${p => p.theme.space.xs};
`;

const EmptyHeader = styled(Flex)`
  justify-content: center;
  align-items: center;
  gap: ${p => p.theme.space.lg};
  color: ${p => p.theme.tokens.content.secondary};
`;

const StyledEmptyStateWarning = styled(EmptyStateWarning)`
  padding: 24px;
`;
