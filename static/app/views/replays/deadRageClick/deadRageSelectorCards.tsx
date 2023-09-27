import {ComponentProps, ReactNode, useState} from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';

import {LinkButton} from 'sentry/components/button';
import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import TextOverflow from 'sentry/components/textOverflow';
import {IconCursorArrow, IconWarning} from 'sentry/icons';
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
  const location = useLocation();

  return (
    <SplitCardContainer>
      <AccordionWidget
        clickType="count_dead_clicks"
        widgetTitle={t('Most Dead Clicks')}
        deadOrRage="dead"
        location={location}
      />
      <AccordionWidget
        clickType="count_rage_clicks"
        widgetTitle={t('Most Rage Clicks')}
        deadOrRage="rage"
        location={location}
      />
    </SplitCardContainer>
  );
}

function AccordionWidget({
  location,
  clickType,
  deadOrRage,
  widgetTitle,
}: {
  clickType: 'count_dead_clicks' | 'count_rage_clicks';
  deadOrRage: string;
  location: Location<any>;
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

  const filteredData = data.filter(d => (d[clickType] ?? 0) > 0);

  return (
    <WidgetContainer>
      <StyledHeaderContainer>
        <HeaderTitleLegend>{widgetTitle}</HeaderTitleLegend>
        <Subtitle>{t('Suggested replays to watch')}</Subtitle>
      </StyledHeaderContainer>
      {isLoading && (
        <StatusContainer>
          <LoadingIndicator />
        </StatusContainer>
      )}
      {isError && (
        <StatusContainer>
          <IconWarning data-test-id="error-indicator" color="gray300" size="lg" />
        </StatusContainer>
      )}
      {!isLoading && filteredData.length === 0 ? (
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
                  <StyledAccordionHeader>
                    <TextOverflow>
                      <code>{d.dom_element}</code>
                    </TextOverflow>
                    <RightAlignedCell>
                      {clickType === 'count_dead_clicks' ? (
                        <DeadClickCount>
                          <IconContainer>
                            <IconCursorArrow size="xs" />
                          </IconContainer>
                          {d[clickType]}
                        </DeadClickCount>
                      ) : (
                        <RageClickCount>
                          <IconContainer>
                            <IconCursorArrow size="xs" />
                          </IconContainer>
                          {d[clickType]}
                        </RageClickCount>
                      )}
                    </RightAlignedCell>
                  </StyledAccordionHeader>
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

const DeadClickCount = styled(TextOverflow)`
  color: ${p => p.theme.yellow300};
`;

const RageClickCount = styled(TextOverflow)`
  color: ${p => p.theme.red300};
`;

const StyledHeaderContainer = styled(HeaderContainer)`
  margin-bottom: ${space(1)};
`;

const StyledContentContainer = styled(ContentContainer)`
  justify-content: flex-start;
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
const StyledEmptyState = styled(ContentContainer)`
  justify-content: center;
`;

export default DeadRageSelectorCards;
