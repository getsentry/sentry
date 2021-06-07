import {useEffect, useState} from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';

import GroupingActions from 'app/actions/groupingActions';
import {Client} from 'app/api';
import Alert from 'app/components/alert';
import Button from 'app/components/button';
import Confirm from 'app/components/confirm';
import EmptyStateWarning from 'app/components/emptyStateWarning';
import List from 'app/components/list';
import ListItem from 'app/components/list/listItem';
import LoadingError from 'app/components/loadingError';
import LoadingIndicator from 'app/components/loadingIndicator';
import {t, tn} from 'app/locale';
import space from 'app/styles/space';
import {Group, Organization, Project} from 'app/types';
import withApi from 'app/utils/withApi';
import RadioGroup from 'app/views/settings/components/forms/controls/radioGroup';

import GroupingCard from './groupingCard';
import HeaderTitle from './headerTitle';

type Props = {
  organization: Organization;
  project: Project;
  groupId: Group['id'];
  location: Location;
  api: Client;
};

type GroupingLevel = {
  id: string;
  isCurrent: boolean;
};

function Grouping({api, groupId, location, organization, project}: Props) {
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [groupingLevels, setGroupingLevels] = useState<GroupingLevel[]>([]);
  const [activeGroupingLevel, setActiveGroupingLevel] = useState<number | undefined>(
    undefined
  );
  const [activeGroupingLevelDetails, setActiveGroupingLevelDetails] = useState<any[]>([]);

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
    setHasError(false);

    try {
      const response = await api.requestPromise(`/issues/${groupId}/grouping/levels/`);
      setIsLoading(false);
      setGroupingLevels(response.levels);
    } catch {
      setIsLoading(false);
      setHasError(true);
    }
  }

  async function fetchGroupingLevelDetails() {
    if (!groupingLevels.length) {
      return;
    }

    setIsLoading(true);
    setHasError(false);
    try {
      const response = await api.requestPromise(
        `/issues/${groupId}/grouping/levels/${activeGroupingLevel}/new-issues/`
      );
      setIsLoading(false);
      setActiveGroupingLevelDetails(response);
    } catch {
      setIsLoading(false);
      setHasError(true);
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

  if (hasError) {
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

  console.log('activeGroupingLevelDetails', activeGroupingLevelDetails);

  function handleSplit() {}

  return (
    <Wrapper>
      <Header>
        <p>
          {t(
            'Sometimes you might want to split up the errors in an issue by different frames in the stacktrace. Below you can select which frames to regroup this issue by and see how many new issues will be created in the process.'
          )}
        </p>
        <Action>
          <Confirm
            disabled={activeGroupingLevel === 0}
            onConfirm={handleSplit}
            message={t(
              'These events will be grouped into a new issue by more specific criteria (for instance more frames). Are you sure you want to split them out of the existing issue?'
            )}
          >
            <Button
              size="xsmall"
              title={
                activeGroupingLevel === 0
                  ? t('The selection of a grouping other than the default is required')
                  : undefined
              }
            >
              {t('Regroup Errors')}
            </Button>
          </Confirm>
        </Action>
      </Header>
      <Body>
        {/* <GroupingCards>
          {groupingLevels.map(groupingLevel => (
            <GroupingCard
              key={groupingLevel.id}
              label={t('Grouping - Level %s', groupingLevel.id)}
              onClick={undefined}
              isActive={groupingLevel.id === String(activeGrouping)}
            />
          ))}
        </GroupingCards> */}
        <StyledList symbol="colored-numeric">
          <StyledListItem>
            <div>
              {t('Select stacktrace frames')}
              <GroupingSelectionInfo>
                {activeGroupingLevel === 0
                  ? t('Automatically grouped')
                  : tn('%s frame', '%s frames', 2)}
              </GroupingSelectionInfo>
            </div>
            <RadioGroup
              value={activeGroupingLevel !== undefined ? String(activeGroupingLevel) : ''}
              label=""
              orientInline
              onChange={groupingLevelId =>
                setActiveGroupingLevel(Number(groupingLevelId))
              }
              choices={groupingLevels.map(groupingLevel => [
                groupingLevel.id,
                groupingLevel.id,
              ])}
            />
          </StyledListItem>
          <ListItem>{t('Preview stacktrace')}</ListItem>
          <ListItem>{t('What happens to this issue')}</ListItem>
        </StyledList>
      </Body>
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

const StyledListItem = styled(ListItem)`
  display: grid;
  grid-gap: ${space(1)};
`;

const GroupingSelectionInfo = styled('div')`
  font-size: ${p => p.theme.fontSizeMedium};
  color: ${p => p.theme.gray400};
`;

const StyledList = styled(List)`
  display: grid;
  grid-gap: ${space(2)};
`;

const Action = styled('div')`
  display: flex;
  justify-content: flex-end;
`;
