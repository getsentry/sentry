import styled from '@emotion/styled';

import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {NewQuery} from 'sentry/types';
import EventView from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {formatAbbreviatedNumber, getDuration} from 'sentry/utils/formatters';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import usePageFilters from 'sentry/utils/usePageFilters';
import {useReleaseSelection} from 'sentry/views/starfish/queries/useReleases';
import {appendReleaseFilters} from 'sentry/views/starfish/utils/releaseComparison';
import {useTableQuery} from 'sentry/views/starfish/views/screens/screensTable';

export function ScreenMetricsRibbon({additionalFilters}: {additionalFilters?: string[]}) {
  const {selection} = usePageFilters();
  const location = useLocation();
  const searchQuery = new MutableSearch([
    'event.type:transaction',
    'transaction.op:ui.load',
    ...(additionalFilters ?? []),
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
    <Container>
      <Flex>
        <MeterBarContainer key="count">
          <MeterBarBody>
            <MeterHeader>{t('Count')}</MeterHeader>
            <MeterValueText>
              {isLoading
                ? undefinedText
                : formatAbbreviatedNumber(data?.data[0]?.['count()'] as number)}
            </MeterValueText>
          </MeterBarBody>
          <MeterBarFooter text={t('Overall')} />
        </MeterBarContainer>
        <MeterBarContainer key="release1 - ttid">
          <MeterBarBody>
            <MeterHeader>{t('Avg TTID')}</MeterHeader>
            <MeterValueText>
              {isLoading
                ? undefinedText
                : getDuration(
                    (data?.data[0]?.[
                      `avg_if(measurements.time_to_initial_display,release,${primaryRelease})`
                    ] as number) / 1000,
                    2,
                    true
                  )}
            </MeterValueText>
          </MeterBarBody>
          <MeterBarFooter text={t('Release 1')} />
        </MeterBarContainer>
        <MeterBarContainer key="release2 - ttid">
          <MeterBarBody>
            <MeterHeader>{t('Avg TTID')}</MeterHeader>
            <MeterValueText>
              {isLoading
                ? undefinedText
                : getDuration(
                    (data?.data[0]?.[
                      `avg_if(measurements.time_to_initial_display,release,${secondaryRelease})`
                    ] as number) / 1000,
                    2,
                    true
                  )}
            </MeterValueText>
          </MeterBarBody>
          <MeterBarFooter text={t('Release 2')} />
        </MeterBarContainer>
        <MeterBarContainer key="release1 - ttfd">
          <MeterBarBody>
            <MeterHeader>{t('Avg TTFD')}</MeterHeader>
            <MeterValueText>
              {isLoading
                ? undefinedText
                : getDuration(
                    (data?.data[0]?.[
                      `avg_if(measurements.time_to_full_display,release,${primaryRelease})`
                    ] as number) / 1000,
                    2,
                    true
                  )}
            </MeterValueText>
          </MeterBarBody>
          <MeterBarFooter text={t('Release 1')} />
        </MeterBarContainer>
        <MeterBarContainer key="release2 - ttfd">
          <MeterBarBody>
            <MeterHeader>{t('Avg TTFD')}</MeterHeader>
            <MeterValueText>
              {isLoading
                ? undefinedText
                : getDuration(
                    (data?.data[0]?.[
                      `avg_if(measurements.time_to_full_display,release,${secondaryRelease})`
                    ] as number) / 1000,
                    2,
                    true
                  )}
            </MeterValueText>
          </MeterBarBody>
          <MeterBarFooter text={t('Release 2')} />
        </MeterBarContainer>
      </Flex>
    </Container>
  );
}

const Container = styled('div')`
  margin-bottom: ${space(2)};
`;

const Flex = styled('div')<{gap?: number}>`
  display: flex;
  flex-direction: row;
  justify-content: center;
  width: 100%;
  gap: ${p => (p.gap ? `${p.gap}px` : space(1))};
  align-items: center;
  flex-wrap: wrap;
`;

const MeterBarContainer = styled('div')`
  flex: 1;
  position: relative;
  padding: 0;
  min-width: 180px;
`;

const MeterBarBody = styled('div')`
  border: 1px solid ${p => p.theme.gray200};
  border-radius: ${p => p.theme.borderRadius} ${p => p.theme.borderRadius} 0 0;
  border-bottom: none;
  padding: ${space(1)} 0 ${space(0.5)} 0;
`;

const MeterHeader = styled('div')`
  font-size: 13px;
  color: ${p => p.theme.textColor};
  font-weight: bold;
  display: inline-block;
  white-space: nowrap;
  text-align: center;
  width: 100%;
`;

const MeterValueText = styled('div')`
  font-size: ${p => p.theme.headerFontSize};
  color: ${p => p.theme.textColor};
  flex: 1;
  text-align: center;
`;

function MeterBarFooter({text}: {text: string}) {
  return <MeterBarFooterContainer>{text}</MeterBarFooterContainer>;
}

const MeterBarFooterContainer = styled('div')`
  border-radius: 0 0 ${p => p.theme.borderRadius} ${p => p.theme.borderRadius};
  font-size: ${p => p.theme.fontSizeExtraSmall};
  padding: ${space(0.5)};
  text-align: center;
  border: solid 1px;
`;
