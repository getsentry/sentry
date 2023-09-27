import {ComponentProps, Fragment, ReactNode, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';

import {LinkButton} from 'sentry/components/button';
import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import TextOverflow from 'sentry/components/textOverflow';
import {IconCursorArrow, IconWarning} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import EventView from 'sentry/utils/discover/eventView';
import getRouteStringFromRoutes from 'sentry/utils/getRouteStringFromRoutes';
import useDeadRageSelectors from 'sentry/utils/replays/hooks/useDeadRageSelectors';
import useReplayList from 'sentry/utils/replays/hooks/useReplayList';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {useRoutes} from 'sentry/utils/useRoutes';
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
import {ReplayCell} from 'sentry/views/replays/replayTable/tableCell';
import {ReplayListLocationQuery} from 'sentry/views/replays/types';

function transformSelectorQuery(selector: string) {
  return selector
    .replaceAll('"', `\\"`)
    .replaceAll('aria=', 'aria-label=')
    .replaceAll('testid=', 'data-test-id=');
}

function UseExampleReplays(selector, location, clickType, deadOrRage) {
  const organization = useOrganization();
  const query = transformSelectorQuery(selector);
  const {project, environment, start, statsPeriod, utc, end} = location.query;
  const emptyLocation: Location<ReplayListLocationQuery> = useMemo(() => {
    return {
      pathname: '',
      search: '',
      hash: '',
      state: '',
      action: 'PUSH' as const,
      key: '',
      query: {project, environment, start, statsPeriod, utc, end},
    };
  }, [project, environment, start, statsPeriod, utc, end]);

  const eventView = useMemo(
    () =>
      EventView.fromNewQueryWithLocation(
        {
          id: '',
          name: '',
          version: 2,
          fields: [
            'activity',
            'duration',
            'id',
            'project_id',
            'user',
            'finished_at',
            'is_archived',
            'started_at',
            'urls',
          ],
          projects: [],
          query: `${deadOrRage}.selector:"${query}"`,
          orderby: `-${clickType}`,
        },
        emptyLocation
      ),
    [emptyLocation, query, clickType, deadOrRage]
  );

  const {replays, isFetching, fetchError} = useReplayList({
    eventView,
    location: emptyLocation,
    organization,
    perPage: 3,
  });

  const routes = useRoutes();
  const referrer = getRouteStringFromRoutes(routes);

  return (
    <Fragment>
      {fetchError || (!isFetching && !replays?.length) ? (
        <EmptyStateWarning withIcon={false} small>
          {t('No replays found')}
        </EmptyStateWarning>
      ) : (
        replays?.map(r => {
          return (
            <ReplayCell
              key="session"
              replay={r}
              eventView={eventView}
              organization={organization}
              referrer={referrer}
              showUrl={false}
              referrer_table="main"
            />
          );
        })
      )}
    </Fragment>
  );
}

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
    <Fragment>
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
          <StyledContainerContainer>
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
                  content: () =>
                    UseExampleReplays(d.dom_element, location, clickType, deadOrRage),
                };
              })}
            />
          </StyledContainerContainer>
        )}
        <SearchButton
          label={t('See all selectors')}
          path="selectors"
          sort={`-${clickType}`}
        />
      </WidgetContainer>
    </Fragment>
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

const StyledContainerContainer = styled(ContentContainer)`
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
