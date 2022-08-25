import styled from '@emotion/styled';

import AsyncComponent from 'sentry/components/asyncComponent';
import Card from 'sentry/components/card';
import EventOrGroupTitle from 'sentry/components/eventOrGroupTitle';
import * as Layout from 'sentry/components/layouts/thirds';
import space from 'sentry/styles/space';
import {Group, Organization, Project} from 'sentry/types';

type Props = {
  issue: Group;
  organization: Organization;
  project: Project;
} & AsyncComponent['props'];

type State = any;

class IssueSetCarouselItem extends AsyncComponent<Props, State> {
  getEndpoints() {
    return [];
  }

  renderBody() {
    const {issue} = this.props;
    return (
      <StyledCard>
        <IssueHeader>
          <EventOrGroupTitle hasGuideAnchor data={issue} />
        </IssueHeader>
      </StyledCard>
    );
  }
}

const StyledCard = styled(Card)`
  margin: ${space(2)} 0;
`;

const IssueHeader = styled(Layout.Header)`
  display: flex;
  line-height: 24px;
  font-size: ${p => p.theme.fontSizeLarge};
`;

export default IssueSetCarouselItem;
