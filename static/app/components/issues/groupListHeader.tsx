import {IssueStreamHeaderLabel} from 'sentry/components/IssueStreamHeaderLabel';
import {PanelHeader} from 'sentry/components/panels/panelHeader';
import {t} from 'sentry/locale';
import {COLUMN_BREAKPOINTS} from 'sentry/views/issueList/actions/utils';

import type {GroupListColumn} from './groupList';

type Props = {
  withChart: boolean;
  withColumns?: GroupListColumn[];
};

export function GroupListHeader({
  withChart,
  withColumns = ['graph', 'event', 'users', 'assignee', 'lastTriggered'],
}: Props) {
  return (
    <PanelHeader disablePadding>
      <IssueStreamHeaderLabel
        hideDivider
        flex="1"
        paddingLeft="xl"
        style={{textTransform: 'capitalize'}}
      >
        {t('Issue')}
      </IssueStreamHeaderLabel>
      {withColumns.includes('lastSeen') && (
        <IssueStreamHeaderLabel
          display={{zero: 'none', [COLUMN_BREAKPOINTS.LAST_SEEN]: 'inline-block'}}
          align="right"
          width="80px"
          style={{textTransform: 'capitalize'}}
        >
          {t('Last Seen')}
        </IssueStreamHeaderLabel>
      )}
      {withColumns.includes('firstSeen') && (
        <IssueStreamHeaderLabel
          display={{zero: 'none', [COLUMN_BREAKPOINTS.FIRST_SEEN]: 'inline-block'}}
          align="right"
          width="50px"
          style={{textTransform: 'capitalize'}}
        >
          {t('Age')}
        </IssueStreamHeaderLabel>
      )}
      {withColumns.includes('lastTriggered') && (
        <IssueStreamHeaderLabel
          align="right"
          width="100px"
          style={{textTransform: 'capitalize'}}
        >
          {t('Last Triggered')}
        </IssueStreamHeaderLabel>
      )}
      {withChart && (
        <IssueStreamHeaderLabel
          display={{zero: 'none', [COLUMN_BREAKPOINTS.TREND]: 'inline-block'}}
          width="175px"
          style={{textTransform: 'capitalize'}}
        >
          {t('Graph')}
        </IssueStreamHeaderLabel>
      )}
      {withColumns.includes('event') && (
        <IssueStreamHeaderLabel
          display={{zero: 'none', [COLUMN_BREAKPOINTS.EVENTS]: 'inline-block'}}
          align="right"
          width="60px"
          style={{textTransform: 'capitalize'}}
        >
          {t('Events')}
        </IssueStreamHeaderLabel>
      )}
      {withColumns.includes('users') && (
        <IssueStreamHeaderLabel
          display={{zero: 'none', [COLUMN_BREAKPOINTS.USERS]: 'inline-block'}}
          align="right"
          width="60px"
          style={{textTransform: 'capitalize'}}
        >
          {t('Users')}
        </IssueStreamHeaderLabel>
      )}
      {withColumns.includes('priority') && (
        <IssueStreamHeaderLabel
          display={{zero: 'none', [COLUMN_BREAKPOINTS.PRIORITY]: 'inline-block'}}
          align="right"
          width="70px"
          style={{textTransform: 'capitalize'}}
        >
          {t('Priority')}
        </IssueStreamHeaderLabel>
      )}
      {withColumns.includes('progress') && (
        <IssueStreamHeaderLabel
          display={{zero: 'none', [COLUMN_BREAKPOINTS.PROGRESS]: 'inline-block'}}
          align="right"
          width="90px"
          style={{textTransform: 'capitalize'}}
        >
          {t('Progress')}
        </IssueStreamHeaderLabel>
      )}
      {withColumns.includes('assignee') && (
        <IssueStreamHeaderLabel
          display={{zero: 'none', [COLUMN_BREAKPOINTS.ASSIGNEE]: 'inline-block'}}
          align="right"
          width="66px"
          style={{textTransform: 'capitalize'}}
        >
          {t('Assignee')}
        </IssueStreamHeaderLabel>
      )}
    </PanelHeader>
  );
}
