import {ComponentProps, ReactNode, useState} from 'react';
import styled from '@emotion/styled';

import {LinkButton} from 'sentry/components/button';
import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import QuestionTooltip from 'sentry/components/questionTooltip';
import TextOverflow from 'sentry/components/textOverflow';
import {IconCursorArrow} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import useDeadRageSelectors from 'sentry/utils/replays/hooks/useDeadRageSelectors';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import Accordion from 'sentry/views/performance/landing/widgets/components/accordion';
import {RightAlignedCell} from 'sentry/views/performance/landing/widgets/components/selectableList';
import {
  ContentContainer,
  HeaderContainer,
  HeaderTitleLegend,
  StatusContainer,
  Subtitle,
  WidgetContainer,
} from 'sentry/views/profiling/landing/styles';
import ExampleReplaysList from 'sentry/views/replays/deadRageClick/exampleReplaysList';

function DeadRageSelectorCards() {
  return (
    <SplitCardContainer>
      <AccordionWidget
        clickType="count_dead_clicks"
        widgetTitle={t('Most Dead Clicks')}
        deadOrRage="dead"
        tooltip={t('The top selectors your users have dead clicked on.')}
      />
      <AccordionWidget
        clickType="count_rage_clicks"
        widgetTitle={t('Most Rage Clicks')}
        deadOrRage="rage"
        tooltip={t('The top selectors your users have rage clicked on.')}
      />
    </SplitCardContainer>
  );
}

function AccordionWidget({
  clickType,
  deadOrRage,
  widgetTitle,
  tooltip,
}: {
  clickType: 'count_dead_clicks' | 'count_rage_clicks';
  deadOrRage: 'dead' | 'rage';
  tooltip: string;
  widgetTitle: string;
}) {
  const [selectedListIndex, setSelectListIndex] = useState(0);
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
    <WidgetContainer>
      <StyledHeaderContainer>
        {deadOrRage === 'dead' ? (
          <DeadClickColor>
            <IconCursorArrow />
          </DeadClickColor>
        ) : (
          <RageClickColor>
            <IconCursorArrow />
          </RageClickColor>
        )}
        <div>
          <StyledWidgetHeader>
            {widgetTitle}
            <QuestionTooltip size="xs" position="top" title={tooltip} isHoverable />
          </StyledWidgetHeader>
          <Subtitle>{t('Suggested replays to watch')}</Subtitle>
        </div>
      </StyledHeaderContainer>
      {isLoading && (
        <StatusContainer>
          <LoadingIndicator />
        </StatusContainer>
      )}
      {isError || (!isLoading && filteredData.length === 0) ? (
        <StyledEmptyState>
          <EmptyStateWarning>
            <p>{t('No results found')}</p>
          </EmptyStateWarning>
        </StyledEmptyState>
      ) : (
        <StyledContentContainer>
          <Accordion
            expandedIndex={selectedListIndex}
            setExpandedIndex={setSelectListIndex}
            items={filteredData.map(d => {
              return {
                header: () => (
                  <AccordionItemHeader
                    count={d[clickType] ?? 0}
                    deadOrRage={deadOrRage}
                    selector={d.dom_element}
                  />
                ),
                content: () => (
                  <ExampleReplaysList
                    selector={d.dom_element}
                    location={location}
                    clickType={clickType}
                    deadOrRage={deadOrRage}
                  />
                ),
              };
            })}
          />
        </StyledContentContainer>
      )}
      <SearchButton
        label={t('See all selectors')}
        path="selectors"
        sort={`-${clickType}`}
      />
    </WidgetContainer>
  );
}

function AccordionItemHeader({
  count,
  deadOrRage,
  selector,
}: {
  count: number;
  deadOrRage: 'dead' | 'rage';
  selector: string;
}) {
  const clickCount =
    deadOrRage === 'dead' ? (
      <DeadClickColor>
        <IconContainer>
          <IconCursorArrow size="xs" />
        </IconContainer>
        {count}
      </DeadClickColor>
    ) : (
      <RageClickColor>
        <IconContainer>
          <IconCursorArrow size="xs" />
        </IconContainer>
        {count}
      </RageClickColor>
    );

  return (
    <StyledAccordionHeader>
      <TextOverflow>
        <code>{selector}</code>
      </TextOverflow>
      <RightAlignedCell>{clickCount}</RightAlignedCell>
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
  padding-top: ${space(1)};
`;

const IconContainer = styled('span')`
  margin-right: ${space(1)};
`;

const DeadClickColor = styled(TextOverflow)`
  color: ${p => p.theme.yellow300};
`;

const RageClickColor = styled(TextOverflow)`
  color: ${p => p.theme.red300};
`;

const StyledHeaderContainer = styled(HeaderContainer)`
  grid-auto-flow: row;
  align-items: center;
  grid-template-rows: auto;
  grid-template-columns: 30px auto;
`;

const StyledContentContainer = styled(ContentContainer)`
  justify-content: flex-start;
`;

const StyledEmptyState = styled(ContentContainer)`
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

const StyledWidgetHeader = styled(HeaderTitleLegend)`
  display: grid;
  gap: ${space(1)};
  justify-content: start;
  align-items: center;
`;

export default DeadRageSelectorCards;
