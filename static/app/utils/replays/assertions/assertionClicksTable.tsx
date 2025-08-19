import styled from '@emotion/styled';
import uniqBy from 'lodash/uniqBy';

import waitingForEventImg from 'sentry-images/spot/waiting-for-event.svg';

import type {ApiResult} from 'sentry/api';
import Stacked from 'sentry/components/container/stacked';
import InteractionStateLayer from 'sentry/components/core/interactionStateLayer';
import {Text} from 'sentry/components/core/text';
import {Tooltip} from 'sentry/components/core/tooltip';
import InfiniteListState from 'sentry/components/infiniteList/infiniteListState';
import InfiniteSimpleTable from 'sentry/components/infiniteList/infiniteSimpleTable';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {t} from 'sentry/locale';
import {useInfiniteApiQuery} from 'sentry/utils/queryClient';
import hydrateSelectorData from 'sentry/utils/replays/hydrateSelectorData';
import useOrganization from 'sentry/utils/useOrganization';
import type {
  DeadRageSelectorItem,
  DeadRageSelectorListResponse,
} from 'sentry/views/replays/types';

interface Props {
  environment: string;
  onSelect: (replayId: string) => void;
  projectId: string;
}

export default function ReplayAssertionsTable({projectId, onSelect: _}: Props) {
  const organization = useOrganization();

  const queryResult = useInfiniteApiQuery<DeadRageSelectorListResponse>({
    queryKey: [
      'infinite',
      `/organizations/${organization.slug}/replay-selectors/`,
      {
        query: {
          query: 'count_dead_clicks:>-1',
          project: projectId,
          statsPeriod: '90d',
        },
      },
    ],
  });

  return (
    <SimpleTableInfinite>
      <SimpleTableInfiniteHeader>
        <SimpleTable.HeaderCell>{t('Element')}</SimpleTable.HeaderCell>
        <SimpleTable.HeaderCell>{t('Selector')}</SimpleTable.HeaderCell>
        <SimpleTable.HeaderCell>{t('Aria Label')}</SimpleTable.HeaderCell>
      </SimpleTableInfiniteHeader>
      <InfiniteListState
        queryResult={queryResult}
        backgroundUpdatingMessage={() => null}
        loadingMessage={() => <LoadingIndicator />}
      >
        <InfiniteSimpleTable<
          DeadRageSelectorItem,
          ApiResult<DeadRageSelectorListResponse>
        >
          deduplicateItems={pages =>
            pages.flatMap(page => {
              return uniqBy(
                hydrateSelectorData(page[0].data, null),
                'dom_element.fullSelector'
              );
            })
          }
          estimateSize={() => 58}
          queryResult={queryResult}
          rowRenderer={({item, virtualRow}) => (
            <SimpleTableInfiniteRow key={virtualRow.index}>
              <InteractionStateLayer />

              <SimpleTable.RowCell>
                <Stacked>
                  <div style={{visibility: 'hidden'}}>{t('Element')}</div>
                  <Text ellipsis>{item.element}</Text>
                </Stacked>
              </SimpleTable.RowCell>
              <SimpleTable.RowCell>
                <Stacked>
                  <div style={{visibility: 'hidden'}}>{t('Element')}</div>
                  <Text ellipsis>{item.dom_element.fullSelector}</Text>
                  {/* <SelectorLink
                    value={item.dom_element}
                    selectorQuery={`dead.selector:"${transformSelectorQuery(item)}"`}
                    projectId={item.project_id.toString()}
                  /> */}
                </Stacked>
              </SimpleTable.RowCell>
              <SimpleTable.RowCell>
                <Stacked>
                  <div style={{visibility: 'hidden'}}>{t('Element')}</div>
                  <Text ellipsis>{item.aria_label}</Text>
                </Stacked>
              </SimpleTable.RowCell>
            </SimpleTableInfiniteRow>
          )}
          emptyMessage={() => <NoReplays />}
          loadingMoreMessage={() => (
            <Centered>
              <Tooltip title={t('Loading more replays...')}>
                <LoadingIndicator mini />
              </Tooltip>
            </Centered>
          )}
          loadingCompleteMessage={() => null}
        />
      </InfiniteListState>
    </SimpleTableInfinite>
  );
}

function NoReplays() {
  return (
    <NoReplaysWrapper>
      <img src={waitingForEventImg} alt={t('A person waiting for a phone to ring')} />
      <NoReplaysMessage>{t('Inbox Zero')}</NoReplaysMessage>
      <p>{t('You have two options: take a nap or be productive.')}</p>
    </NoReplaysWrapper>
  );
}

const Centered = styled('div')`
  justify-self: center;
`;

const NoReplaysWrapper = styled('div')`
  padding: ${p => p.theme.space['3xl']};
  text-align: center;
  color: ${p => p.theme.subText};

  @media (max-width: ${p => p.theme.breakpoints.sm}) {
    font-size: ${p => p.theme.fontSize.md};
  }
`;

const NoReplaysMessage = styled('div')`
  font-weight: ${p => p.theme.fontWeight.bold};
  color: ${p => p.theme.gray400};

  @media (min-width: ${p => p.theme.breakpoints.sm}) {
    font-size: ${p => p.theme.fontSize.xl};
  }
`;

const SimpleTableInfinite = styled(SimpleTable)`
  display: flex;
  flex-direction: column;
`;

const SimpleTableInfiniteHeader = styled(SimpleTable.Header)`
  display: flex;
  flex-direction: row;

  display: grid;
  grid-template-columns: max-content 1fr max-content;
`;

const SimpleTableInfiniteRow = styled(SimpleTable.Row)`
  display: flex;
  flex-direction: row;

  display: grid;
  grid-template-columns: max-content 1fr max-content;
`;
