import type {ReactNode} from 'react';
import {useState} from 'react';
import styled from '@emotion/styled';

import Accordion from 'sentry/components/container/accordion';
import {Flex, type FlexProps} from 'sentry/components/core/layout';
import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import Placeholder from 'sentry/components/placeholder';
import QuestionTooltip from 'sentry/components/questionTooltip';
import TextOverflow from 'sentry/components/textOverflow';
import {IconCursorArrow, IconSearch} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import useDeadRageSelectors from 'sentry/utils/replays/hooks/useDeadRageSelectors';
import {useLocation} from 'sentry/utils/useLocation';
import {
  HeaderContainer,
  HeaderTitleLegend,
  Subtitle,
  WidgetContainer,
} from 'sentry/views/profiling/landing/styles';
import ExampleReplaysList from 'sentry/views/replays/selectors/exampleReplaysList';
import ProjectInfo from 'sentry/views/replays/selectors/projectInfo';
import {SelectorLink} from 'sentry/views/replays/selectors/selectorLink';
import {transformSelectorQuery} from 'sentry/views/replays/selectors/utils';

export default function DeadRageSelectorCards() {
  return (
    <SplitCardContainer>
      <AccordionWidget
        clickType="count_dead_clicks"
        header={
          <div>
            <StyledWidgetHeader>
              <TitleTooltipContainer>
                {t('Most Dead Clicks')}
                <QuestionTooltip
                  size="xs"
                  position="top"
                  title={t(
                    'The top selectors your users have dead clicked on (i.e., a user click that does not result in any page activity after 7 seconds).'
                  )}
                  isHoverable
                />
              </TitleTooltipContainer>
            </StyledWidgetHeader>
            <Subtitle>{t('Suggested replays to watch')}</Subtitle>
          </div>
        }
        deadOrRage="dead"
      />
      <AccordionWidget
        clickType="count_rage_clicks"
        header={
          <div>
            <StyledWidgetHeader>
              <TitleTooltipContainer>
                {t('Most Rage Clicks')}
                <QuestionTooltip
                  size="xs"
                  position="top"
                  title={t(
                    'The top selectors your users have rage clicked on (i.e., 5 or more clicks on a dead element, which exhibits no page activity after 7 seconds).'
                  )}
                  isHoverable
                />
              </TitleTooltipContainer>
            </StyledWidgetHeader>
            <Subtitle>{t('Suggested replays to watch')}</Subtitle>
          </div>
        }
        deadOrRage="rage"
      />
    </SplitCardContainer>
  );
}

function AccordionWidget({
  clickType,
  deadOrRage,
  header,
}: {
  clickType: 'count_dead_clicks' | 'count_rage_clicks';
  deadOrRage: 'dead' | 'rage';
  header: ReactNode;
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
    <StyledWidgetContainer data-test-id="selector-widget">
      <StyledHeaderContainer>
        <IconCursorArrow variant={clickVariant} />
        {header}
      </StyledHeaderContainer>
      {isLoading ? (
        <LoadingContainer>
          <StyledPlaceholder />
          <StyledPlaceholder />
          <StyledPlaceholder />
        </LoadingContainer>
      ) : isError || (!isLoading && filteredData.length === 0) ? (
        <Flex flex="1 1 auto" direction="column" justify="center">
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
        </Flex>
      ) : (
        <Flex flex="1 1 auto" direction="column" justify="start">
          <Accordion
            collapsible
            expandedIndex={selectedListIndex}
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
        </Flex>
      )}
    </StyledWidgetContainer>
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
  gap: 0 ${space(2)};
  align-items: stretch;
`;

const ClickCount = styled(TextOverflow)`
  color: ${p => p.theme.colors.gray500};
  display: grid;
  grid-template-columns: auto auto;
  gap: ${space(0.75)};
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
  padding: ${space(0.25)};
  align-items: center;
`;

const TitleTooltipContainer = styled('div')`
  display: flex;
  gap: ${space(1)};
  align-items: center;
`;

const StyledWidgetHeader = styled(HeaderTitleLegend)`
  display: grid;
  justify-content: space-between;
  align-items: center;
`;

const StyledWidgetContainer = styled(WidgetContainer)`
  margin-bottom: 0;
  padding-top: ${space(1.5)};
`;

export const RightAlignedCell = styled('div')`
  text-align: right;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: ${space(1)};
  padding-left: ${space(1)};
`;

const EmptySubtitle = styled('div')`
  font-size: ${p => p.theme.fontSize.md};
  line-height: 1.6em;
  padding-left: ${space(1)};
  padding-right: ${space(1)};
`;

const LoadingContainer = styled((props: FlexProps) => (
  <Flex gap="2xs" flex="1 1 auto" direction="column" justify="start" {...props} />
))`
  padding: ${space(1)} ${space(0.5)} 3px ${space(0.5)};
`;

const StyledPlaceholder = styled(Placeholder)`
  height: 36px;
`;

const EmptyHeader = styled(Flex)`
  justify-content: center;
  align-items: center;
  gap: ${space(1.5)};
  color: ${p => p.theme.tokens.content.secondary};
`;

const StyledEmptyStateWarning = styled(EmptyStateWarning)`
  padding: 24px;
`;
