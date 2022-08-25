import styled from '@emotion/styled';

import Button from 'sentry/components/button';
import Card from 'sentry/components/card';
import EventOrGroupExtraDetails from 'sentry/components/eventOrGroupExtraDetails';
import EventOrGroupHeader from 'sentry/components/eventOrGroupHeader';
import {Panel, PanelHeader} from 'sentry/components/panels';
import space from 'sentry/styles/space';
import {Organization} from 'sentry/types';

type Props = {
  issueSet: any;
  organization: Organization;
};

function IssueSetListItem({issueSet, organization}: Props) {
  const basePath = `/organizations/${organization.slug}/issues/sets/`;
  return (
    <StyledPanel>
      <details>
        <SetSummary>
          <StyledPanelHeader>
            {issueSet.name}
            <Button href={basePath.concat(issueSet.id)} size="xs">
              View as Carousel
            </Button>
          </StyledPanelHeader>
        </SetSummary>
        <SetContentsContainer>
          {issueSet.items?.map((item, index) => (
            <SetContents key={item.id}>
              <EventOrGroupHeader
                index={index}
                data={item.issueDetails}
                includeLink
                size="normal"
              />
              <EventOrGroupExtraDetails
                data={item.issueDetails}
                showInboxTime
                showAssignee
              />
            </SetContents>
          ))}
        </SetContentsContainer>
      </details>
    </StyledPanel>
  );
}

const StyledPanel = styled(Panel)`
  overflow: hidden;
`;

const SetSummary = styled('summary')`
  cursor: pointer;
`;

const StyledPanelHeader = styled(PanelHeader)`
  border-bottom: 0px;
`;

const SetContentsContainer = styled('div')`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
  max-height: 600px;
`;

const SetContents = styled(Card)`
  margin: ${space(1)} ${space(1)};
  padding: ${space(1)} ${space(3)};
  overflow-x: hidden;
`;

export default IssueSetListItem;
