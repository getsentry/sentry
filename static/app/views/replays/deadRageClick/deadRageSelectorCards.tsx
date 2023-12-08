import {ComponentProps, ReactNode, useState} from 'react';
import styled from '@emotion/styled';

import Accordion from 'sentry/components/accordion/accordion';
import {LinkButton} from 'sentry/components/button';
import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import FeatureBadge from 'sentry/components/featureBadge';
import Placeholder from 'sentry/components/placeholder';
import {Flex} from 'sentry/components/profiling/flex';
import QuestionTooltip from 'sentry/components/questionTooltip';
import TextOverflow from 'sentry/components/textOverflow';
import {IconCursorArrow, IconSearch} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import useDeadRageSelectors from 'sentry/utils/replays/hooks/useDeadRageSelectors';
import {ColorOrAlias} from 'sentry/utils/theme';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import {
  ContentContainer,
  HeaderContainer,
  HeaderTitleLegend,
  Subtitle,
  WidgetContainer,
} from 'sentry/views/profiling/landing/styles';
import ExampleReplaysList from 'sentry/views/replays/deadRageClick/exampleReplaysList';
import {
  ProjectInfo,
  SelectorLink,
  transformSelectorQuery,
} from 'sentry/views/replays/deadRageClick/selectorTable';

function DeadRageSelectorCards() {
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
              <FeatureBadge type="new" />
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
              <FeatureBadge type="new" />
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
  const clickColor = deadOrRage === 'dead' ? 'yellow300' : 'red300';

  return (
    <StyledWidgetContainer data-test-id="selector-widget">
      <StyledHeaderContainer>
        <IconCursorArrow color={clickColor} />
        {header}
      </StyledHeaderContainer>
      {isLoading ? (
        <LoadingContainer>
          <StyledPlaceholder />
          <StyledPlaceholder />
          <StyledPlaceholder />
        </LoadingContainer>
      ) : isError || (!isLoading && filteredData.length === 0) ? (
        <CenteredContentContainer>
          <EmptyStateWarning withIcon={false}>
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
          </EmptyStateWarning>
        </CenteredContentContainer>
      ) : (
        <LeftAlignedContentContainer>
          <Accordion
            buttonOnLeft
            collapsible
            expandedIndex={selectedListIndex}
            setExpandedIndex={setSelectListIndex}
            items={filteredData.map(d => {
              const selectorQuery = `${deadOrRage}.selector:"${transformSelectorQuery(
                d.dom_element.fullSelector
              )}"`;
              return {
                header: () => (
                  <AccordionItemHeader
                    count={d[clickType] ?? 0}
                    selector={d.dom_element.selector}
                    clickColor={clickColor}
                    selectorQuery={selectorQuery}
                    id={d.project_id}
                  />
                ),
                content: () => (
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
        </LeftAlignedContentContainer>
      )}
      <SearchButton
        label={t('See all selectors')}
        path="selectors"
        sort={`-${clickType}`}
      />
    </StyledWidgetContainer>
  );
}

function AccordionItemHeader({
  count,
  clickColor,
  selector,
  selectorQuery,
  id,
}: {
  clickColor: ColorOrAlias;
  count: number;
  id: number;
  selector: string;
  selectorQuery: string;
}) {
  const clickCount = (
    <ClickCount>
      <IconCursorArrow size="xs" color={clickColor} />
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

function SearchButton({
  label,
  sort,
  path,
  ...props
}: {
  label: ReactNode;
  path: string;
  sort: string;
} & Omit<ComponentProps<typeof LinkButton>, 'size' | 'to'>) {
  const location = useLocation();
  const organization = useOrganization();

  return (
    <StyledButton
      {...props}
      size="xs"
      to={{
        pathname: normalizeUrl(`/organizations/${organization.slug}/replays/${path}/`),
        query: {
          ...location.query,
          sort,
          query: undefined,
          cursor: undefined,
        },
      }}
    >
      {label}
    </StyledButton>
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
  color: ${p => p.theme.gray400};
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

const LeftAlignedContentContainer = styled(ContentContainer)`
  justify-content: flex-start;
`;

const CenteredContentContainer = styled(ContentContainer)`
  justify-content: center;
`;

const StyledButton = styled(LinkButton)`
  width: 100%;
  border-radius: ${p => p.theme.borderRadiusBottom};
  padding: ${space(3)};
  border-bottom: none;
  border-left: none;
  border-right: none;
  font-size: ${p => p.theme.fontSizeMedium};
`;

const StyledAccordionHeader = styled('div')`
  display: grid;
  grid-template-columns: 1fr max-content;
  flex: 1;
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
  font-size: ${p => p.theme.fontSizeMedium};
  line-height: 1.6em;
  padding-left: ${space(1)};
  padding-right: ${space(1)};
`;

const LoadingContainer = styled(ContentContainer)`
  gap: ${space(0.25)};
  padding: ${space(1)} ${space(0.5)} 3px ${space(0.5)};
`;

const StyledPlaceholder = styled(Placeholder)`
  height: 34px;
`;

const EmptyHeader = styled(Flex)`
  justify-content: center;
  align-items: center;
  gap: ${space(1.5)};
  color: ${p => p.theme.gray300};
`;

export default DeadRageSelectorCards;
