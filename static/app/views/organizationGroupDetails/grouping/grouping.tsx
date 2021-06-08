import {Fragment, useEffect, useState} from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';

import {Client} from 'app/api';
import Button from 'app/components/button';
import EmptyStateWarning from 'app/components/emptyStateWarning';
import List from 'app/components/list';
import ListItem from 'app/components/list/listItem';
import LoadingError from 'app/components/loadingError';
import LoadingIndicator from 'app/components/loadingIndicator';
import {IconFlag} from 'app/icons';
import {t, tct, tn} from 'app/locale';
import space from 'app/styles/space';
import {Group, Organization, Project} from 'app/types';
import {Event} from 'app/types/event';
import withApi from 'app/utils/withApi';
import EmptyMessage from 'app/views/settings/components/emptyMessage';
import RangeSlider from 'app/views/settings/components/forms/controls/rangeSlider';

import NewIssue from './newIssue';

type Props = {
  organization: Organization;
  project: Project;
  groupId: Group['id'];
  location: Location;
  api: Client;
};

type Error = {
  status: number;
  responseJSON?: {
    detail: string;
  };
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

function Grouping({api, groupId, location}: Props) {
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

  useEffect(() => {
    fetchGroupingLevels();
  }, []);

  useEffect(() => {
    setCurrentGrouping();
  }, [groupingLevels]);

  useEffect(() => {
    fetchGroupingLevelDetails();
  }, [activeGroupingLevel]);

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
      const response = await api.requestPromise(
        `/issues/${groupId}/grouping/levels/${activeGroupingLevel}/new-issues/`
      );

      setActiveGroupingLevelDetails(response);
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
    if (error.status === 403 && error.responseJSON?.detail) {
      return (
        <Wrapper>
          <EmptyMessage
            icon={<IconFlag size="xl" />}
            action={
              <Button
                to={`/organizations/sentry/issues/${groupId}/merged/?${location.search}`}
              >
                {t('Unmerged issue')}
              </Button>
            }
          >
            {error.responseJSON.detail}
          </EmptyMessage>
        </Wrapper>
      );
    }

    return (
      <LoadingError
        message={t('Unable to load grouping levels, please try again later')}
        onRetry={fetchGroupingLevels}
      />
    );
  }

  if (!groupingLevels.length) {
    return (
      <EmptyStateWarning withIcon={false}>
        {t('No grouping levels have been found.')}
      </EmptyStateWarning>
    );
  }

  //function handleRegroup() {
  // Todo(Priscila): Implement it
  //}

  return (
    <Wrapper>
      <Header>
        <p>
          {t(
            'Sometimes you might want to split up the errors in an issue by different frames in the stacktrace. Below you can select which frames to regroup this issue by and see how many new issues will be created in the process.'
          )}
        </p>
      </Header>
      <Body>
        <StyledList symbol="colored-numeric">
          <StyledListItem>
            {t('Select levels')}
            <StyledRangeSlider
              name="grouping-level"
              allowedValues={groupingLevels.map(groupingLevel =>
                Number(groupingLevel.id)
              )}
              formatLabel={value => {
                return value === 0
                  ? t('Automatically grouped')
                  : tn('%s leve', '%s leves', value);
              }}
              value={activeGroupingLevel ?? 0}
              onChange={groupingLevelId =>
                setActiveGroupingLevel(Number(groupingLevelId))
              }
            />
          </StyledListItem>
          <StyledListItem>
            {isGroupingLevelDetailsLoading ? (
              <div>
                <div>{t('What happens to this issue')}</div>
                <LoadingIndicator mini />
              </div>
            ) : (
              <Fragment>
                <div>
                  {t('What happens to this issue')}
                  <WhatHappensDescription>
                    {tct(
                      `This issue will be deleted and [quantity] new issues will be created.`,
                      {quantity: activeGroupingLevelDetails.length}
                    )}
                  </WhatHappensDescription>
                </div>
                <NewIssues>
                  {activeGroupingLevelDetails.map(activeGroupingLevelDetail => (
                    <NewIssue
                      key={activeGroupingLevelDetail.hash}
                      event={activeGroupingLevelDetail.latestEvent}
                    />
                  ))}
                </NewIssues>
              </Fragment>
            )}
          </StyledListItem>
        </StyledList>
      </Body>
      <Footer>
        <Button priority="primary" disabled={isGroupingLevelDetailsLoading}>
          {t('Regroup')}
        </Button>
      </Footer>
    </Wrapper>
  );
}

export default withApi(Grouping);

const Wrapper = styled('div')`
  flex: 1;
  display: grid;
  background: ${p => p.theme.white};
  grid-gap: ${space(2)};
  margin: -${space(3)} -${space(4)};
  padding: ${space(3)} ${space(4)};
`;

const Header = styled('div')`
  display: grid;
  grid-gap: ${space(1)};
  grid-template-columns: max-content 1fr;
`;

const Body = styled('div')``;

const Footer = styled('div')`
  border-top: 1px solid ${p => p.theme.innerBorder};
  display: flex;
  justify-content: flex-end;
  padding: ${space(2)} 0 0;
  margin-top: ${space(1)};
`;

const StyledListItem = styled(ListItem)`
  display: grid;
  grid-gap: ${space(1.5)};
`;

const StyledRangeSlider = styled(RangeSlider)`
  max-width: 10%;
`;

const StyledList = styled(List)`
  display: grid;
  grid-gap: ${space(2)};
  font-size: ${p => p.theme.fontSizeExtraLarge};
`;

const NewIssues = styled('div')`
  display: grid;
  grid-template-columns: minmax(100px, 1fr);
  grid-gap: ${space(2)};

  @media (min-width: ${p => p.theme.breakpoints[1]}) {
    grid-template-columns: repeat(2, minmax(100px, 1fr));
  }

  @media (min-width: ${p => p.theme.breakpoints[2]}) {
    grid-template-columns: repeat(3, minmax(100px, 1fr));
  }
`;

const WhatHappensDescription = styled('div')`
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizeLarge};
`;
