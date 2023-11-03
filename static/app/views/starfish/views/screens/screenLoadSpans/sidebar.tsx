import {Fragment} from 'react';
import styled from '@emotion/styled';

import Version from 'sentry/components/version';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {NewQuery} from 'sentry/types';
import EventView from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {formatAbbreviatedNumber, getDuration} from 'sentry/utils/formatters';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {SidebarSpacer} from 'sentry/views/performance/transactionSummary/utils';
import {useReleaseSelection} from 'sentry/views/starfish/queries/useReleases';
import {appendReleaseFilters} from 'sentry/views/starfish/utils/releaseComparison';
import {YAxis} from 'sentry/views/starfish/views/screens';
import {useTableQuery} from 'sentry/views/starfish/views/screens/screensTable';

type ScreenMetrics = {
  [key in YAxis]: number;
};

type Props = {
  transaction: string;
  screenMetrics?: ScreenMetrics;
};

export function ScreenLoadSpansSidebar({transaction}: Props) {
  const {selection} = usePageFilters();
  const location = useLocation();
  const organization = useOrganization();
  const searchQuery = new MutableSearch([
    'event.type:transaction',
    'transaction.op:ui.load',
    `transaction:${transaction}`,
  ]);

  const {
    primaryRelease,
    secondaryRelease,
    isLoading: isReleasesLoading,
  } = useReleaseSelection();

  const queryStringPrimary = appendReleaseFilters(
    searchQuery,
    primaryRelease,
    secondaryRelease
  );

  const newQuery: NewQuery = {
    name: 'ScreenMetricsRibbon',
    fields: [
      `avg_if(measurements.time_to_initial_display,release,${primaryRelease})`,
      `avg_if(measurements.time_to_initial_display,release,${secondaryRelease})`,
      `avg_if(measurements.time_to_full_display,release,${primaryRelease})`,
      `avg_if(measurements.time_to_full_display,release,${secondaryRelease})`,
      'count()',
    ],
    query: queryStringPrimary,
    dataset: DiscoverDatasets.METRICS,
    version: 2,
    projects: selection.projects,
  };
  const eventView = EventView.fromNewQueryWithLocation(newQuery, location);
  const {data, isLoading} = useTableQuery({
    eventView,
    enabled: !isReleasesLoading,
  });

  const undefinedText = '--';

  return (
    <Fragment>
      <SectionHeading>{t('Count')}</SectionHeading>
      <SidebarMetricsValue>
        {isLoading
          ? undefinedText
          : formatAbbreviatedNumber(data?.data[0]?.['count()'] as number)}
      </SidebarMetricsValue>
      <SidebarSpacer />
      <SectionHeading>{t('Avg TTID')}</SectionHeading>
      <Container>
        <ContainerItem>
          <Label>{t('Release 1')}</Label>
          {secondaryRelease && (
            <Version
              organization={organization}
              version={primaryRelease}
              tooltipRawVersion
            />
          )}
          <SidebarMetricsValue>
            {isLoading
              ? undefinedText
              : getDuration(
                  (data?.data[0]?.[
                    `avg_if(measurements.time_to_initial_display,release,${primaryRelease})`
                  ] as number) / 1000,
                  2,
                  true
                )}
          </SidebarMetricsValue>
        </ContainerItem>

        <ContainerItem>
          <Label>{t('Release 2')}</Label>
          {secondaryRelease && (
            <Version
              organization={organization}
              version={secondaryRelease}
              tooltipRawVersion
            />
          )}
          <SidebarMetricsValue>
            {isLoading
              ? undefinedText
              : getDuration(
                  (data?.data[0]?.[
                    `avg_if(measurements.time_to_initial_display,release,${secondaryRelease})`
                  ] as number) / 1000,
                  2,
                  true
                )}
          </SidebarMetricsValue>
        </ContainerItem>
      </Container>
      <SidebarSpacer />
      <SectionHeading>{t('Avg TTFD')}</SectionHeading>
      <Container>
        <ContainerItem>
          <Label>{t('Release 1')}</Label>
          {secondaryRelease && (
            <Version
              organization={organization}
              version={primaryRelease}
              tooltipRawVersion
            />
          )}
          <SidebarMetricsValue>
            {isLoading
              ? undefinedText
              : getDuration(
                  (data?.data[0]?.[
                    `avg_if(measurements.time_to_full_display,release,${primaryRelease})`
                  ] as number) / 1000,
                  2,
                  true
                )}
          </SidebarMetricsValue>
        </ContainerItem>
        <ContainerItem>
          <Label>{t('Release 2')}</Label>
          {secondaryRelease && (
            <Version
              organization={organization}
              version={secondaryRelease}
              tooltipRawVersion
              truncate
            />
          )}
          <SidebarMetricsValue>
            {isLoading
              ? undefinedText
              : getDuration(
                  (data?.data[0]?.[
                    `avg_if(measurements.time_to_full_display,release,${secondaryRelease})`
                  ] as number) / 1000,
                  2,
                  true
                )}
          </SidebarMetricsValue>
        </ContainerItem>
      </Container>
      <SidebarSpacer />
    </Fragment>
  );
}

const SectionHeading = styled('h4')`
  display: inline-grid;
  grid-auto-flow: column;
  gap: ${space(1)};
  align-items: center;
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizeMedium};
  margin: 0;
`;

const SidebarMetricsValue = styled('div')`
  font-size: ${p => p.theme.fontSizeExtraLarge};
`;

const Container = styled('div')`
  display: flex;
  flex: 1;
  align-items: center;
`;

const ContainerItem = styled('div')`
  flex: 1;
`;

const Label = styled('div')`
  font-weight: bold;
`;
