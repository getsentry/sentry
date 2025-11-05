import {Fragment, useEffect, useMemo, useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import emptyTraceImg from 'sentry-images/spot/performance-empty-trace.svg';

import {Button} from '@sentry/scraps/button/button';
import {ButtonBar} from '@sentry/scraps/button/buttonBar';
import {Flex} from '@sentry/scraps/layout';

import {Text} from 'sentry/components/core/text';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Panel from 'sentry/components/panels/panel';
import BaseSearchBar from 'sentry/components/searchBar';
import {IconChevron} from 'sentry/icons/iconChevron';
import {IconMegaphone} from 'sentry/icons/iconMegaphone';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {useDebouncedValue} from 'sentry/utils/useDebouncedValue';
import {useFeedbackForm} from 'sentry/utils/useFeedbackForm';
import type {ChartInfo} from 'sentry/views/explore/components/chart/types';
import useAttributeBreakdowns from 'sentry/views/explore/hooks/useAttributeBreakdowns';
import type {BoxSelectOptions} from 'sentry/views/explore/hooks/useChartBoxSelect';

import {Chart} from './chart';
import {useChartSelection} from './chartSelectionContext';
import {SortingToggle, type SortingMethod} from './sortingToggle';

const CHARTS_COLUMN_COUNT = 3;
const CHARTS_PER_PAGE = CHARTS_COLUMN_COUNT * 4;

function FeedbackButton() {
  const openForm = useFeedbackForm();

  if (!openForm) {
    return null;
  }

  return (
    <Button
      size="xs"
      aria-label="attribute-breakdowns-feedback"
      icon={<IconMegaphone size="xs" />}
      onClick={() =>
        openForm?.({
          messagePlaceholder: t(
            'How can we make attribute breakdowns work better for you?'
          ),
          tags: {
            ['feedback.source']: 'attribute-breakdowns',
            ['feedback.owner']: 'ml-ai',
          },
        })
      }
    >
      {t('Feedback')}
    </Button>
  );
}

function EmptyState() {
  return (
    <Flex direction="column" gap="xl" padding="xl">
      <Flex align="center" justify="between">
        <Text bold size="lg">
          {t('Examine what sets your selection apart')}
        </Text>
        <FeedbackButton />
      </Flex>
      <Text>
        {t(
          "Drag to select an area on the chart and click 'Find Attribute Breakdowns' to analyze differences between selected and unselected (baseline) data. Attributes that differ most in frequency appear first, making it easier to identify key differences:"
        )}
      </Text>
      <IllustrationWrapper>
        <Illustration src={emptyTraceImg} alt="Attribute breakdowns illustration" />
      </IllustrationWrapper>
    </Flex>
  );
}

function ContentImpl({
  boxSelectOptions,
  chartInfo,
}: {
  boxSelectOptions: BoxSelectOptions;
  chartInfo: ChartInfo;
}) {
  const {data, isLoading, isError} = useAttributeBreakdowns({
    boxSelectOptions,
    chartInfo,
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [sortingMethod, setSortingMethod] = useState<SortingMethod>('rrr');
  const [page, setPage] = useState(0);
  const theme = useTheme();

  // Debouncing the search query here to ensure smooth typing, by delaying the re-mounts a little as the user types.
  // query here to ensure smooth typing, by delaying the re-mounts a little as the user types.
  const debouncedSearchQuery = useDebouncedValue(searchQuery, 100);

  const filteredRankedAttributes = useMemo(() => {
    const attrs = data?.rankedAttributes;
    if (!attrs) {
      return [];
    }

    let filteredAttrs = attrs;
    if (debouncedSearchQuery.trim()) {
      const searchFor = debouncedSearchQuery.toLocaleLowerCase().trim();
      filteredAttrs = attrs.filter(attr =>
        attr.attributeName.toLocaleLowerCase().trim().includes(searchFor)
      );
    }

    const sortedAttrs = [...filteredAttrs].sort((a, b) => {
      const aOrder = a.order[sortingMethod];
      const bOrder = b.order[sortingMethod];

      if (aOrder === null && bOrder === null) return 0;
      if (aOrder === null) return 1;
      if (bOrder === null) return -1;

      return aOrder - bOrder;
    });

    return sortedAttrs;
  }, [debouncedSearchQuery, data?.rankedAttributes, sortingMethod]);

  useEffect(() => {
    // Ensure that we are on the first page whenever filtered attributes change.
    setPage(0);
  }, [filteredRankedAttributes]);

  return (
    <Flex direction="column" gap="xl" padding="xl">
      {isLoading ? (
        <LoadingIndicator />
      ) : isError ? (
        <LoadingError message={t('Failed to load attribute breakdowns')} />
      ) : (
        <Fragment>
          <ControlsContainer>
            <StyledBaseSearchBar
              placeholder={t('Search keys')}
              onChange={query => {
                setSearchQuery(query);
              }}
              query={debouncedSearchQuery}
              size="sm"
            />
            <SortingToggle value={sortingMethod} onChange={setSortingMethod} />
          </ControlsContainer>
          {filteredRankedAttributes.length > 0 ? (
            <Fragment>
              <ChartsGrid>
                {filteredRankedAttributes
                  .slice(page * CHARTS_PER_PAGE, (page + 1) * CHARTS_PER_PAGE)
                  .map(attribute => (
                    <Chart
                      key={attribute.attributeName}
                      attribute={attribute}
                      theme={theme}
                      cohort1Total={data?.cohort1Total ?? 0}
                      cohort2Total={data?.cohort2Total ?? 0}
                    />
                  ))}
              </ChartsGrid>
              <PaginationContainer>
                <ButtonBar merged gap="0">
                  <Button
                    icon={<IconChevron direction="left" />}
                    aria-label={t('Previous')}
                    size="sm"
                    disabled={page === 0}
                    onClick={() => {
                      setPage(page - 1);
                    }}
                  />
                  <Button
                    icon={<IconChevron direction="right" />}
                    aria-label={t('Next')}
                    size="sm"
                    disabled={
                      page ===
                      Math.ceil(filteredRankedAttributes.length / CHARTS_PER_PAGE) - 1
                    }
                    onClick={() => {
                      setPage(page + 1);
                    }}
                  />
                </ButtonBar>
              </PaginationContainer>
            </Fragment>
          ) : (
            <NoAttributesMessage>{t('No matching attributes found')}</NoAttributesMessage>
          )}
        </Fragment>
      )}
    </Flex>
  );
}

export function AttributeBreakdownsContent() {
  const {chartSelection} = useChartSelection();

  return (
    <Panel>
      {chartSelection ? (
        <ContentImpl
          boxSelectOptions={chartSelection.boxSelectOptions}
          chartInfo={chartSelection.chartInfo}
        />
      ) : (
        <EmptyState />
      )}
    </Panel>
  );
}

const IllustrationWrapper = styled('div')`
  position: relative;
  height: 200px;
  margin-top: ${space(3)};

  @media (max-width: ${p => p.theme.breakpoints.sm}) {
    display: none;
  }
`;

const Illustration = styled('img')`
  position: absolute;
  display: block;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  pointer-events: none;
  height: 100%;
  overflow: hidden;
`;

const ControlsContainer = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(1.5)};
  margin-bottom: ${space(1)};
`;

const StyledBaseSearchBar = styled(BaseSearchBar)`
  flex: 1;
`;

const NoAttributesMessage = styled('div')`
  display: flex;
  justify-content: center;
  align-items: center;
  color: ${p => p.theme.subText};
`;

const ChartsGrid = styled('div')`
  display: grid;
  grid-template-columns: repeat(${CHARTS_COLUMN_COUNT}, 1fr);
  gap: ${space(1)};
`;

const PaginationContainer = styled('div')`
  display: flex;
  justify-content: end;
  align-items: center;
`;
