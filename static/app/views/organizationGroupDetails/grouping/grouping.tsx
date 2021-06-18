import {useEffect, useState} from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';
import debounce from 'lodash/debounce';

import {Client} from 'app/api';
import LoadingIndicator from 'app/components/loadingIndicator';
import Pagination from 'app/components/pagination';
import PaginationCaption from 'app/components/pagination/paginationCaption';
import {Panel, PanelBody, PanelHeader} from 'app/components/panels';
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

  function setSecondGrouping() {
    const secondGrouping = groupingLevels[1];
    if (!secondGrouping) {
      return;
    }
    setActiveGroupingLevel(Number(secondGrouping.id));
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
      <Panel>
        <PanelHeader>{t('Issue drill down')}</PanelHeader>
        <PanelBody withPadding>
          <Description>
            {t(
              'This issue is built up of multiple events that sentry thinks come from the same root-cause. Use this page to drill down this issue into more fine-grained groups.'
            )}
          </Description>
          <Content>
            <SliderWrapper>
              {t('Fewer issues')}
              <StyledRangeSlider
                name="grouping-level"
                allowedValues={groupingLevels.map(groupingLevel =>
                  Number(groupingLevel.id)
                )}
                value={activeGroupingLevel ?? 0}
                onChange={handleSetActiveGroupingLevel}
                showLabel={false}
              />
              {t('More issues')}
            </SliderWrapper>
            <div>
              <NewIssues isReloading={isGroupingLevelDetailsLoading}>
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
              <StyledPagination
                pageLinks={pagination}
                caption={
                  <PaginationCaption
                    caption={
                      hasMore
                        ? tct('Showing [current] of [total] Issues', {
                            current: paginationCurrentQuantity,
                            total: `${paginationCurrentQuantity}+`,
                          })
                        : tct('Showing [current] of [total] Issue', {
                            current: paginationCurrentQuantity,
                            total: paginationCurrentQuantity,
                          })
                    }
                  />
                }
              />
            </div>
          </Content>
        </PanelBody>
      </Panel>
    </Wrapper>
  );
}

export default withApi(Grouping);

const Wrapper = styled('div')`
  flex: 1;
  display: grid;
  align-content: flex-start;
  background: ${p => p.theme.background};
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

const NewIssues = styled(Panel)<{isReloading: boolean}>`
  margin-bottom: 0;
  ${p =>
    p.isReloading &&
    `
    opacity: 0.5;
    pointer-events: none;
  `}
`;

const StyledPagination = styled(Pagination)`
  margin-top: ${space(1.5)};
`;

const SliderWrapper = styled('div')`
  display: grid;
  grid-gap: ${space(1.5)};
  grid-template-columns: max-content max-content;
  justify-content: space-between;
  align-items: flex-start;
  position: relative;
  font-size: ${p => p.theme.fontSizeMedium};
  color: ${p => p.theme.gray400};
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
