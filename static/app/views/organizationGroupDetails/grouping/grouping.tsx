import {useEffect, useState} from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';
import debounce from 'lodash/debounce';

import {Client} from 'app/api';
import LoadingIndicator from 'app/components/loadingIndicator';
import Pagination from 'app/components/pagination';
import PaginationCaption from 'app/components/pagination/paginationCaption';
import {PanelTable} from 'app/components/panels';
import {DEFAULT_DEBOUNCE_DURATION} from 'app/constants';
import {t, tct, tn} from 'app/locale';
import space from 'app/styles/space';
import {Group, Organization} from 'app/types';
import {Event} from 'app/types/event';
import {defined} from 'app/utils';
import parseLinkHeader from 'app/utils/parseLinkHeader';
import withApi from 'app/utils/withApi';
import RangeSlider from 'app/views/settings/components/forms/controls/rangeSlider';

import ErrorMessage from './errorMessage';
import NewIssue from './newIssue';

type Error = React.ComponentProps<typeof ErrorMessage>['error'];

type Props = {
  organization: Organization;
  groupId: Group['id'];
  location: Location;
  api: Client;
};

type GroupingLevelDetails = {
  eventCount: number;
  hash: string;
  latestEvent: Event;
};

type GroupingLevel = {
  id: string;
  isCurrent: boolean;
};

function Grouping({api, groupId, location, organization}: Props) {
  const [isLoading, setIsLoading] = useState(false);
  const [isGroupingLevelDetailsLoading, setIsGroupingLevelDetailsLoading] = useState(
    false
  );
  const [error, setError] = useState<undefined | Error>(undefined);
  const [groupingLevels, setGroupingLevels] = useState<GroupingLevel[]>([]);
  const [activeGroupingLevel, setActiveGroupingLevel] = useState<number | undefined>(
    undefined
  );
  const [activeGroupingLevelDetails, setActiveGroupingLevelDetails] = useState<
    GroupingLevelDetails[]
  >([]);

  const [pagination, setPagination] = useState('');

  useEffect(() => {
    fetchGroupingLevels();
  }, []);

  useEffect(() => {
    setSecondGrouping();
  }, [groupingLevels]);

  useEffect(() => {
    fetchGroupingLevelDetails();
  }, [activeGroupingLevel, location.query]);

  const handleSetActiveGroupingLevel = debounce((groupingLevelId: number | '') => {
    setActiveGroupingLevel(Number(groupingLevelId));
  }, DEFAULT_DEBOUNCE_DURATION);

  async function fetchGroupingLevels() {
    setIsLoading(true);
    setError(undefined);

    try {
      const response = await api.requestPromise(`/issues/${groupId}/grouping/levels/`);
      setIsLoading(false);
      setGroupingLevels(response.levels);
    } catch (err) {
      setIsLoading(false);
      setError(err);
    }
  }

  async function fetchGroupingLevelDetails() {
    if (!groupingLevels.length || !defined(activeGroupingLevel)) {
      return;
    }

    setIsGroupingLevelDetailsLoading(true);
    setError(undefined);

    try {
      const [response, , xhr] = await api.requestPromise(
        `/issues/${groupId}/grouping/levels/${activeGroupingLevel}/new-issues/`,
        {
          method: 'GET',
          includeAllArgs: true,
          query: {
            ...location.query,
            per_page: 10,
          },
        }
      );

      const pageLinks = xhr && xhr.getResponseHeader?.('Link');
      setPagination(pageLinks ?? '');
      setActiveGroupingLevelDetails(Array.isArray(response) ? response : [response]);
      setIsGroupingLevelDetailsLoading(false);
    } catch (err) {
      setIsGroupingLevelDetailsLoading(false);
      setError(err);
    }
  }

  function setSecondGrouping() {
    if (!groupingLevels.length) {
      return;
    }

    if (groupingLevels.length > 1) {
      setActiveGroupingLevel(Number(groupingLevels[1].id));
      return;
    }

    setActiveGroupingLevel(Number(groupingLevels[0].id));
  }

  if (isLoading) {
    return <LoadingIndicator />;
  }

  if (error) {
    return <ErrorMessage onRetry={fetchGroupingLevels} groupId={groupId} error={error} />;
  }

  if (!activeGroupingLevelDetails.length) {
    return <LoadingIndicator />;
  }

  const links = parseLinkHeader(pagination);
  const hasMore = links.previous?.results || links.next?.results;
  const paginationCurrentQuantity = activeGroupingLevelDetails.length;

  return (
    <Wrapper>
      <Description>
        {t(
          'This issue is an aggregate of multiple events that sentry determined originate from the same root-cause. Use this page to explore more detailed groupings that exist within this issue.'
        )}
      </Description>
      <Content>
        <SliderWrapper>
          {t('Fewer issues')}
          <StyledRangeSlider
            name="grouping-level"
            allowedValues={groupingLevels.map(groupingLevel => Number(groupingLevel.id))}
            value={activeGroupingLevel ?? 0}
            onChange={handleSetActiveGroupingLevel}
            showLabel={false}
          />
          {t('More issues')}
        </SliderWrapper>
        <div>
          <StyledPanelTable
            isReloading={isGroupingLevelDetailsLoading}
            headers={['', t('Events')]}
          >
            {activeGroupingLevelDetails.map(({hash, latestEvent, eventCount}) => (
              <NewIssue
                key={hash}
                sampleEvent={latestEvent}
                eventCount={eventCount}
                organization={organization}
              />
            ))}
          </StyledPanelTable>
          <StyledPagination
            pageLinks={pagination}
            caption={
              <PaginationCaption
                caption={tct('Showing [current] of [total] [result]', {
                  result: hasMore
                    ? t('results')
                    : tn('result', 'results', paginationCurrentQuantity),
                  current: paginationCurrentQuantity,
                  total: hasMore
                    ? `${paginationCurrentQuantity}+`
                    : paginationCurrentQuantity,
                })}
              />
            }
          />
        </div>
      </Content>
    </Wrapper>
  );
}

export default withApi(Grouping);

const Wrapper = styled('div')`
  flex: 1;
  display: grid;
  align-content: flex-start;
  margin: -${space(3)} -${space(4)};
  padding: ${space(3)} ${space(4)};
`;

const Description = styled('p')`
  && {
    margin-bottom: ${space(2)};
  }
`;

const Content = styled('div')`
  display: grid;
  grid-gap: ${space(3)};
`;

const StyledPanelTable = styled(PanelTable)<{isReloading: boolean}>`
  grid-template-columns: 1fr minmax(60px, auto);
  ${p =>
    p.isReloading &&
    `
      opacity: 0.5;
      pointer-events: none;
    `}

  > * {
    padding: ${space(1.5)} ${space(2)};
    :nth-child(-n + 2) {
      padding: ${space(2)};
    }
    :nth-child(2n) {
      display: flex;
      text-align: right;
      justify-content: flex-end;
    }
  }

  @media (min-width: ${p => p.theme.breakpoints[3]}) {
    grid-template-columns: 1fr minmax(80px, auto);
  }
`;

const StyledPagination = styled(Pagination)`
  margin-top: 0;
`;

const SliderWrapper = styled('div')`
  display: grid;
  grid-gap: ${space(1.5)};
  grid-template-columns: max-content max-content;
  justify-content: space-between;
  align-items: flex-start;
  position: relative;
  font-size: ${p => p.theme.fontSizeMedium};
  color: ${p => p.theme.subText};
  padding-bottom: ${space(2)};

  @media (min-width: 700px) {
    grid-template-columns: max-content minmax(270px, auto) max-content;
    align-items: center;
    justify-content: flex-start;
    padding-bottom: 0;
  }
`;

const StyledRangeSlider = styled(RangeSlider)`
  input {
    margin-top: 0;
    margin-bottom: 0;
  }

  position: absolute;
  bottom: 0;
  left: ${space(1.5)};
  right: ${space(1.5)};

  @media (min-width: 700px) {
    position: static;
    left: auto;
    right: auto;
  }
`;
