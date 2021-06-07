import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import GroupingActions from 'app/actions/groupingActions';
import Alert from 'app/components/alert';
import Button from 'app/components/button';
import Confirm from 'app/components/confirm';
import {Panel} from 'app/components/panels';
import QuestionTooltip from 'app/components/questionTooltip';
import {t, tn} from 'app/locale';
import {Fingerprint} from 'app/stores/groupingStore';
import space from 'app/styles/space';
import {Group} from 'app/types';

import HeaderTitle from '../headerTitle';

import GroupingCard from './groupingCard';

type Props = {
  groupId: Group['id'];
  issues: Fingerprint[];
};

function GroupedIssues({issues, groupId}: Props) {
  if (!issues.length) {
    return null;
  }

  const [activeGrouping, setActiveGrouping] = useState(0);

  const groupings = [
    [
      {
        childId: issues[0].id,
        childLabel: issues[0].label,
        eventCount: issues[0].eventCount,
        lastSeen: issues[0].lastSeen,
        latestEvent: issues[0].latestEvent,
      },
    ],
    issues[0].children,
  ];

  const regroupDisabled = issues.length !== 1;

  function handleSplit() {
    GroupingActions.toggleUnmerge([issues[0].id, issues[0].latestEvent.id]);
    GroupingActions.split({
      groupId,
      loadingMessage: t('Splitting issue\u2026'),
      successMessage: t('Issue successfully queued for splitting.'),
      errorMessage: t('Unable to queue issue for splitting.'),
    });
  }

  const hideGroupingOptions = issues.length !== 1;

  return (
    <Wrapper hideGroupingOptions={hideGroupingOptions}>
      <StyledHeaderTitle>
        {tn('Grouping Option', 'Grouping Options', groupings.length)}
        <QuestionTooltip
          size="xs"
          position="top"
          title={t(
            'Errors are grouped into this issue automatically based on a number of conditions. Below you can split this issue up into multiple issues if you dislike the default grouping.'
          )}
        />
      </StyledHeaderTitle>
      {hideGroupingOptions ? (
        <Alert type="info">
          {t('Regrouping is only available after unmerging this issue.')}
        </Alert>
      ) : (
        <Fragment>
          <Action>
            <Confirm
              disabled={activeGrouping === 0}
              onConfirm={handleSplit}
              message={t(
                'These events will be grouped into a new issue by more specific criteria (for instance more frames). Are you sure you want to split them out of the existing issue?'
              )}
            >
              <Button
                size="small"
                priority="primary"
                title={
                  activeGrouping === 0
                    ? t('The selection of a grouping other than the default is required')
                    : undefined
                }
              >
                {t('Regroup')}
              </Button>
            </Confirm>
          </Action>
          <StyledPanel>
            <GroupingCards>
              {groupings.map((grouping, index) => (
                <GroupingCard
                  key={index}
                  label={t('Grouping - Level %s', index)}
                  groupings={grouping}
                  onClick={regroupDisabled ? undefined : () => setActiveGrouping(index)}
                  isActive={index === activeGrouping}
                />
              ))}
            </GroupingCards>
          </StyledPanel>
        </Fragment>
      )}
    </Wrapper>
  );
}

export default GroupedIssues;

const Wrapper = styled('div')<{hideGroupingOptions: boolean}>`
  display: grid;
  grid-gap: ${space(2)};
  align-items: center;
  ${p =>
    !p.hideGroupingOptions &&
    `
      grid-template-columns: 1fr max-content;
    `}
`;

const GroupingCards = styled('div')`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(500px, 1fr));
  grid-gap: ${space(2)};
`;

const Action = styled('div')`
  display: flex;
  justify-content: flex-end;
`;

const StyledPanel = styled(Panel)`
  grid-column: 1 / -1;
  padding: ${space(2)};
  background: none;
`;

const StyledHeaderTitle = styled(HeaderTitle)`
  display: grid;
  grid-template-columns: max-content 1fr;
  align-items: center;
  grid-gap: ${space(0.5)};
`;
