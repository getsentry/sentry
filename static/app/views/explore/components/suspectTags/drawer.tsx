import {Fragment, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import {Flex} from 'sentry/components/core/layout';
import {DrawerBody, DrawerHeader} from 'sentry/components/globalDrawer/components';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import BaseSearchBar from 'sentry/components/searchBar';
import {IconMegaphone} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {useDebouncedValue} from 'sentry/utils/useDebouncedValue';
import {useFeedbackForm} from 'sentry/utils/useFeedbackForm';
import type {ChartInfo} from 'sentry/views/explore/components/chart/types';
import {Charts} from 'sentry/views/explore/components/suspectTags/charts';
import {
  SortingToggle,
  type SortingMethod,
} from 'sentry/views/explore/components/suspectTags/sortingToggle';
import type {BoxSelectOptions} from 'sentry/views/explore/hooks/useChartBoxSelect';
import useSuspectAttributes from 'sentry/views/explore/hooks/useSuspectAttributes';

type Props = {
  boxSelectOptions: BoxSelectOptions;
  chartInfo: ChartInfo;
};

function FeedbackButton() {
  const openForm = useFeedbackForm();

  if (!openForm) {
    return null;
  }

  return (
    <Button
      size="xs"
      aria-label="suspect-attributes-feedback"
      icon={<IconMegaphone size="xs" />}
      onClick={() =>
        openForm?.({
          messagePlaceholder: t(
            'How can we make suspect attributes work better for you?'
          ),
          tags: {
            ['feedback.source']: 'suspect-attributes',
            ['feedback.owner']: 'ml-ai',
          },
        })
      }
    >
      {t('Feedback')}
    </Button>
  );
}

export function Drawer({boxSelectOptions, chartInfo}: Props) {
  const {data, isLoading, isError} = useSuspectAttributes({boxSelectOptions, chartInfo});
  const [searchQuery, setSearchQuery] = useState('');
  const [sortingMethod, setSortingMethod] = useState<SortingMethod>('rrf');

  const filteredRankedAttributes = useMemo(() => {
    const attrs = data?.rankedAttributes;
    if (!attrs) {
      return [];
    }

    let filteredAttrs = attrs;
    if (searchQuery.trim()) {
      const searchFor = searchQuery.toLocaleLowerCase().trim();
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
  }, [searchQuery, data?.rankedAttributes, sortingMethod]);

  // We use the search query as a key to virtual list items, to correctly re-mount
  // charts that were invisible before the user searched for it. Debouncing the search
  // query here to ensure smooth typing, by delaying the re-mounts a little as the user types.
  const debouncedSearchQuery = useDebouncedValue(searchQuery, 100);

  return (
    <DrawerContainer>
      <DrawerHeader hideBar />
      <StyledDrawerBody>
        <Flex justify="between" align="center">
          <Title>{t('Suspect Attributes')}</Title>
          <FeedbackButton />
        </Flex>
        <SubTitle>
          {t(
            'Comparing selected and unselected (baseline) data, we sorted  attributes that differ the most in frequency. This indicates how suspicious they are. '
          )}
        </SubTitle>
        {isLoading ? (
          <LoadingIndicator />
        ) : isError ? (
          <LoadingError message={t('Failed to load suspect attributes')} />
        ) : (
          <Fragment>
            <ControlsContainer>
              <StyledBaseSearchBar
                placeholder={t('Search keys')}
                onChange={query => setSearchQuery(query)}
                query={searchQuery}
                size="sm"
              />
              <SortingToggle value={sortingMethod} onChange={setSortingMethod} />
            </ControlsContainer>
            {filteredRankedAttributes.length > 0 ? (
              <Charts
                cohort1Total={data?.cohort1Total ?? 0}
                cohort2Total={data?.cohort2Total ?? 0}
                rankedAttributes={filteredRankedAttributes}
                searchQuery={debouncedSearchQuery}
              />
            ) : (
              <NoAttributesMessage>
                {t('No matching attributes found')}
              </NoAttributesMessage>
            )}
          </Fragment>
        )}
      </StyledDrawerBody>
    </DrawerContainer>
  );
}

const Title = styled('h4')`
  margin: 0;
  flex-shrink: 0;
`;

const ControlsContainer = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(1.5)};
  margin-bottom: ${space(1.5)};
`;

const StyledBaseSearchBar = styled(BaseSearchBar)`
  flex: 1;
`;

const SubTitle = styled('span')`
  margin-top: ${space(0.5)};
  margin-bottom: ${space(3)};
`;

const StyledDrawerBody = styled(DrawerBody)`
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
`;

const DrawerContainer = styled('div')`
  display: flex;
  flex-direction: column;
  height: 100%;

  > header {
    flex-shrink: 0;
  }
`;

const NoAttributesMessage = styled('div')`
  display: flex;
  justify-content: center;
  align-items: center;
  margin-top: ${space(4)};
  color: ${p => p.theme.subText};
`;
