import {Fragment, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {DrawerBody, DrawerHeader} from 'sentry/components/globalDrawer/components';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import BaseSearchBar from 'sentry/components/searchBar';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {useDebouncedValue} from 'sentry/utils/useDebouncedValue';
import type {ChartInfo} from 'sentry/views/explore/charts';
import {Charts} from 'sentry/views/explore/components/suspectTags/charts';
import type {BoxSelectOptions} from 'sentry/views/explore/hooks/useChartBoxSelect';
import useSuspectAttributes from 'sentry/views/explore/hooks/useSuspectAttributes';

type Props = {
  boxSelectOptions: BoxSelectOptions;
  chartInfo: ChartInfo;
};

export function Drawer({boxSelectOptions, chartInfo}: Props) {
  const {data, isLoading, isError} = useSuspectAttributes({boxSelectOptions, chartInfo});
  const [searchQuery, setSearchQuery] = useState('');

  const filteredRankedAttributes = useMemo(() => {
    const attrs = data?.rankedAttributes;
    if (!attrs) {
      return [];
    }

    if (!searchQuery.trim()) {
      return attrs;
    }

    const searchFor = searchQuery.toLocaleLowerCase().trim();

    return attrs.filter(attr =>
      attr.attributeName.toLocaleLowerCase().trim().includes(searchFor)
    );
  }, [searchQuery, data?.rankedAttributes]);

  // We use the search query as a key to virtual list items, to correctly re-mount
  // charts the were invisible before the user searched for it. Debouncing the search
  // query here to ensure smooth typing, by delaying the re-mounts a little as the user types.
  const debouncedSearchQuery = useDebouncedValue(searchQuery, 100);

  return (
    <DrawerContainer>
      <DrawerHeader hideBar />
      <StyledDrawerBody>
        <Title>{t('Suspect Attributes')}</Title>
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
            <StyledBaseSearchBar
              placeholder={t('Search keys')}
              onChange={query => setSearchQuery(query)}
              query={searchQuery}
              size="sm"
            />
            {filteredRankedAttributes.length > 0 ? (
              <Charts
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
  margin-bottom: ${space(0.5)};
  flex-shrink: 0;
`;

const StyledBaseSearchBar = styled(BaseSearchBar)`
  margin-bottom: ${space(1.5)};
`;

const SubTitle = styled('span')`
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
