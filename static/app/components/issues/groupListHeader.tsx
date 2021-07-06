import styled from '@emotion/styled';

import {PanelHeader} from 'app/components/panels';
import {t} from 'app/locale';
import space from 'app/styles/space';

type Props = {
  withChart: boolean;
  narrowGroups?: boolean;
};

const GroupListHeader = ({withChart = true, narrowGroups = false}: Props) => (
  <PanelHeader disablePadding>
    <IssueWrapper>{t('Issue')}</IssueWrapper>
    {withChart && (
      <ChartWrapper className={`hidden-xs hidden-sm ${narrowGroups ? 'hidden-md' : ''}`}>
        {t('Graph')}
      </ChartWrapper>
    )}
    <EventUserWrapper>{t('events')}</EventUserWrapper>
    <EventUserWrapper>{t('users')}</EventUserWrapper>
    <AssigneeWrapper className="hidden-xs hidden-sm toolbar-header">
      {t('Assignee')}
    </AssigneeWrapper>
  </PanelHeader>
);

export default GroupListHeader;

const Heading = styled('div')`
  display: flex;
  align-self: center;
  margin: 0 ${space(2)};
`;

const IssueWrapper = styled(Heading)`
  flex: 1;
  width: 66.66%;

  @media (min-width: ${p => p.theme.breakpoints[1]}) {
    width: 50%;
  }
`;

const EventUserWrapper = styled(Heading)`
  justify-content: flex-end;
  width: 60px;

  @media (min-width: ${p => p.theme.breakpoints[3]}) {
    width: 80px;
  }
`;

const ChartWrapper = styled(Heading)`
  justify-content: space-between;
  width: 160px;
`;

const AssigneeWrapper = styled(Heading)`
  justify-content: flex-end;
  width: 80px;
`;
