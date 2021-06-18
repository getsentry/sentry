import {useEffect, useState} from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';
import debounce from 'lodash/debounce';

import {Client} from 'app/api';
import List from 'app/components/list';
import ListItem from 'app/components/list/listItem';
import LoadingIndicator from 'app/components/loadingIndicator';
import Pagination from 'app/components/pagination';
import {DEFAULT_DEBOUNCE_DURATION} from 'app/constants';
import {t, tct} from 'app/locale';
import space from 'app/styles/space';
import {Group, Organization, Project} from 'app/types';
import {Event} from 'app/types/event';
import parseLinkHeader from 'app/utils/parseLinkHeader';
import withApi from 'app/utils/withApi';
import RangeSlider from 'app/views/settings/components/forms/controls/rangeSlider';

import ErrorMessage from './errorMessage';
import NewIssue from './newIssue';

type Error = React.ComponentProps<typeof ErrorMessage>['error'];

type Props = {
  organization: Organization;
  project: Project;
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

function Grouping({api, groupId, location, project, organization}: Props) {
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
    setCurrentGrouping();
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
    if (!groupingLevels.length) {
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

  function setCurrentGrouping() {
    const currentGrouping = groupingLevels.find(groupingLevel => groupingLevel.isCurrent);
    if (!currentGrouping) {
      return;
    }
    setActiveGroupingLevel(Number(currentGrouping.id));
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

  return (
    <Wrapper>
      <Description>
        {t(
          'Sometimes you might want to split up issues by additional frames or other criteria. Select a granularity level below and see how many new issues will be created in the process.'
        )}
      </Description>
      <div>
        <StyledList symbol="colored-numeric">
          <StyledListItem>
            {t('Select level')}
            <StyledRangeSlider
              name="grouping-level"
              allowedValues={groupingLevels.map(groupingLevel =>
                Number(groupingLevel.id)
              )}
              formatLabel={value => {
                return value === 0 ? t('Automatically grouped') : t('Level %s', value);
              }}
              value={activeGroupingLevel ?? 0}
              onChange={handleSetActiveGroupingLevel}
            />
          </StyledListItem>
          <StyledListItem isReloading={isGroupingLevelDetailsLoading}>
            <div>
              {t('What happens to this issue')}
              <WhatHappensDescription>
                {tct(
                  `This issue will be deleted and [quantity] new issues will be created.`,
                  {
                    quantity: hasMore
                      ? `${activeGroupingLevelDetails.length}+`
                      : activeGroupingLevelDetails.length,
                  }
                )}
              </WhatHappensDescription>
            </div>
            <NewIssues>
              {activeGroupingLevelDetails.map(({hash, latestEvent, eventCount}) => (
                <NewIssue
                  key={hash}
                  sampleEvent={latestEvent}
                  eventCount={eventCount}
                  project={project}
                  organization={organization}
                />
              ))}
            </NewIssues>
          </StyledListItem>
        </StyledList>
        <Pagination pageLinks={pagination} />
      </div>
    </Wrapper>
  );
}

export default withApi(Grouping);

const Wrapper = styled('div')`
  flex: 1;
  display: grid;
  align-content: flex-start;
  background: ${p => p.theme.background};
  grid-gap: ${space(2)};
  margin: -${space(3)} -${space(4)};
  padding: ${space(3)} ${space(4)};
`;

const Description = styled('p')`
  margin-bottom: ${space(0.5)};
`;

const NewIssues = styled('div')`
  display: grid;
  grid-gap: ${space(3)};
`;

const WhatHappensDescription = styled('div')`
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizeLarge};
`;

const StyledListItem = styled(ListItem)<{isReloading?: boolean}>`
  display: grid;
  grid-gap: ${space(1.5)};

  ${p =>
    p.isReloading &&
    `
      ${NewIssues}, ${WhatHappensDescription} {
        opacity: 0.5;
        pointer-events: none;
      }
    `}
`;

const StyledRangeSlider = styled(RangeSlider)`
  max-width: 300px;
`;

const StyledList = styled(List)`
  display: grid;
  grid-gap: ${space(2)};
  font-size: ${p => p.theme.fontSizeExtraLarge};
`;
