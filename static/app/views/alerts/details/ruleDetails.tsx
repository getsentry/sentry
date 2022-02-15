import type {RouteComponentProps} from 'react-router';

import AsyncComponent from 'sentry/components/asyncComponent';
import {Organization} from 'sentry/types';

type Props = AsyncComponent['props'] & {
  organization: Organization;
} & RouteComponentProps<{organizationId: string; projectId: string}, {}>;

type State = AsyncComponent['state'] & {};

class TeamStability extends AsyncComponent<Props, State> {
  shouldRenderBadRequests = true;

  getDefaultState(): State {
    return {
      ...super.getDefaultState(),
    };
  }

  getEndpoints() {
    // TODO
    return [];
  }

  renderLoading() {
    return this.renderBody();
  }

  renderBody() {
    return <div>Hello</div>;
  }
}

export default TeamStability;
