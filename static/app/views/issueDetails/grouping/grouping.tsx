import {Fragment, useEffect, useState} from 'react';
import {InjectedRouter} from 'react-router';
import styled from '@emotion/styled';
import {Location} from 'history';
import debounce from 'lodash/debounce';

import {Client} from 'sentry/api';
import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {FeatureFeedback} from 'sentry/components/featureFeedback';
import RangeSlider from 'sentry/components/forms/controls/rangeSlider';
import Slider from 'sentry/components/forms/controls/rangeSlider/slider';
import * as Layout from 'sentry/components/layouts/thirds';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Pagination from 'sentry/components/pagination';
import {PanelTable} from 'sentry/components/panels';
import {DEFAULT_DEBOUNCE_DURATION} from 'sentry/constants';
import {t, tct, tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {BaseGroup, Group, Organization, Project} from 'sentry/types';
import {defined} from 'sentry/utils';
import parseLinkHeader from 'sentry/utils/parseLinkHeader';
import toArray from 'sentry/utils/toArray';
import useCleanQueryParamsOnRouteLeave from 'sentry/utils/useCleanQueryParamsOnRouteLeave';
import withApi from 'sentry/utils/withApi';

import ErrorMessage from './errorMessage';
import NewIssue from './newIssue';

type Error = React.ComponentProps<typeof ErrorMessage>['error'];

type Props = {
  api: Client;
  groupId: Group['id'];
  location: Location<{cursor?: string; level?: number}>;
  organization: Organization;
  projSlug: Project['slug'];
  router: InjectedRouter;
};

type GroupingLevelDetails = Partial<Pick<BaseGroup, 'title' | 'metadata'>> & {
  eventCount: number;
  hash: string;
  latestEvent: BaseGroup['latestEvent'];
};

type GroupingLevel = {
  id: number;
  isCurrent: boolean;
};

export const groupingFeedbackTypes = [
  t('Too eager grouping'),
  t('Too specific grouping'),
  t('Other grouping issue'),
];

const GROUPING_BREAKDOWN__DOC_LINK =
  'https://docs.sentry.io/product/data-management-settings/event-grouping/grouping-breakdown/';

function Grouping({api, groupId, location, organization, router, projSlug}: Props) {
  const {cursor, level} = location.query;
  const [isLoading, setIsLoading] = useState(false);
  const [isGroupingLevelDetailsLoading, setIsGroupingLevelDetailsLoading] =
    useState(false);
  const [error, setError] = useState<undefined | Error | string>(undefined);
  const [groupingLevels, setGroupingLevels] = useState<GroupingLevel[]>([]);
  const [activeGroupingLevel, setActiveGroupingLevel] = useState<number | undefined>(
    undefined
  );
  const [activeGroupingLevelDetails, setActiveGroupingLevelDetails] = useState<
    GroupingLevelDetails[]
  >([]);

  const [pagination, setPagination] = useState('');

  useCleanQueryParamsOnRouteLeave({fieldsToClean: ['cursor', 'level']});
  useEffect(() => {
    fetchGroupingLevels();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setSecondGrouping();
  }, [groupingLevels]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    updateUrlWithNewLevel();
  }, [activeGroupingLevel]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchGroupingLevelDetails();
  }, [activeGroupingLevel, cursor]); // eslint-disable-line react-hooks/exhaustive-deps

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
      const [data, , resp] = await api.requestPromise(
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

      const pageLinks = resp?.getResponseHeader?.('Link');
      setPagination(pageLinks ?? '');
      setActiveGroupingLevelDetails(toArray(data));
      setIsGroupingLevelDetailsLoading(false);
    } catch (err) {
      setIsGroupingLevelDetailsLoading(false);
      setError(err);
    }
  }

  function updateUrlWithNewLevel() {
    if (!defined(activeGroupingLevel) || level === activeGroupingLevel) {
      return;
    }

    router.replace({
      pathname: location.pathname,
      query: {...location.query, cursor: undefined, level: activeGroupingLevel},
    });
  }

  function setSecondGrouping() {
    if (!groupingLevels.length) {
      return;
    }

    if (defined(level)) {
      if (!defined(groupingLevels[level])) {
        setError(t('The level you were looking for was not found.'));
        return;
      }

      if (level === activeGroupingLevel) {
        return;
      }

      setActiveGroupingLevel(level);
      return;
    }

    if (groupingLevels.length > 1) {
      setActiveGroupingLevel(groupingLevels[1].id);
      return;
    }

    setActiveGroupingLevel(groupingLevels[0].id);
  }

  if (isLoading) {
    return <LoadingIndicator />;
  }

  if (error) {
    return (
      <Fragment>
        <Layout.Body>
          <Layout.Main fullWidth>
            <ErrorWrapper>
              <ButtonBar gap={1}>
                <Button href={GROUPING_BREAKDOWN__DOC_LINK} external>
                  {t('Read Docs')}
                </Button>
                <FeatureFeedback
                  featureName="grouping"
                  feedbackTypes={groupingFeedbackTypes}
                />
              </ButtonBar>
              <StyledErrorMessage
                onRetry={fetchGroupingLevels}
                groupId={groupId}
                error={error}
                projSlug={projSlug}
                orgSlug={organization.slug}
                hasProjectWriteAccess={organization.access.includes('project:write')}
              />
            </ErrorWrapper>
          </Layout.Main>
        </Layout.Body>
      </Fragment>
    );
  }

  if (!activeGroupingLevelDetails.length) {
    return <LoadingIndicator />;
  }

  const links = parseLinkHeader(pagination);
  const hasMore = links.previous?.results || links.next?.results;
  const paginationCurrentQuantity = activeGroupingLevelDetails.length;

  return (
    <Layout.Body>
      <Layout.Main fullWidth>
        <Wrapper>
          <Header>
            {t(
              'This issue is an aggregate of multiple events that sentry determined originate from the same root-cause. Use this page to explore more detailed groupings that exist within this issue.'
            )}
          </Header>
          <Body>
            <Actions>
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
              <StyledButtonBar gap={1}>
                <Button href={GROUPING_BREAKDOWN__DOC_LINK} external>
                  {t('Read Docs')}
                </Button>
                <FeatureFeedback
                  featureName="grouping"
                  feedbackTypes={groupingFeedbackTypes}
                />
              </StyledButtonBar>
            </Actions>
            <Content isReloading={isGroupingLevelDetailsLoading}>
              <StyledPanelTable headers={['', t('Events')]}>
                {activeGroupingLevelDetails.map(
                  ({hash, title, metadata, latestEvent, eventCount}) => {
                    // XXX(markus): Ugly hack to make NewIssue show the right things.
                    return (
                      <NewIssue
                        key={hash}
                        sampleEvent={{
                          ...latestEvent,
                          metadata: {
                            ...(metadata || latestEvent.metadata),
                            current_level: activeGroupingLevel,
                          },
                          title: title || latestEvent.title,
                        }}
                        eventCount={eventCount}
                        organization={organization}
                      />
                    );
                  }
                )}
              </StyledPanelTable>
              <StyledPagination
                pageLinks={pagination}
                disabled={isGroupingLevelDetailsLoading}
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
            </Content>
          </Body>
        </Wrapper>
      </Layout.Main>
    </Layout.Body>
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

const Header = styled('p')`
  && {
    margin-bottom: ${space(2)};
  }
`;

const Body = styled('div')`
  display: grid;
  gap: ${space(3)};
`;

const Actions = styled('div')`
  display: grid;
  align-items: center;
  gap: ${space(3)};

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    grid-template-columns: 1fr max-content;
    gap: ${space(2)};
  }
`;

const StyledButtonBar = styled(ButtonBar)`
  justify-content: flex-start;
`;

const StyledErrorMessage = styled(ErrorMessage)`
  width: 100%;
`;

const ErrorWrapper = styled('div')`
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: ${space(1)};
`;

const StyledPanelTable = styled(PanelTable)`
  grid-template-columns: 1fr minmax(60px, auto);
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

  @media (min-width: ${p => p.theme.breakpoints.xlarge}) {
    grid-template-columns: 1fr minmax(80px, auto);
  }
`;

const StyledPagination = styled(Pagination)`
  margin-top: 0;
`;

const Content = styled('div')<{isReloading: boolean}>`
  ${p =>
    p.isReloading &&
    `
      ${StyledPanelTable}, ${StyledPagination} {
        opacity: 0.5;
        pointer-events: none;
      }
    `}
`;

const SliderWrapper = styled('div')`
  display: grid;
  gap: ${space(1.5)};
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
  ${Slider} {
    background: transparent;
    margin-top: 0;
    margin-bottom: 0;

    ::-ms-thumb {
      box-shadow: 0 0 0 3px ${p => p.theme.backgroundSecondary};
    }

    ::-moz-range-thumb {
      box-shadow: 0 0 0 3px ${p => p.theme.backgroundSecondary};
    }

    ::-webkit-slider-thumb {
      box-shadow: 0 0 0 3px ${p => p.theme.backgroundSecondary};
    }
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
