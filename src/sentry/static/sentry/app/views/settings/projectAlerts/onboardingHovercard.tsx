import * as React from 'react';
import {Location} from 'history';
import styled from '@emotion/styled';

import Button from 'app/components/button';
import Hovercard from 'app/components/hovercard';
import {t} from 'app/locale';
import space from 'app/styles/space';
import withApi from 'app/utils/withApi';
import {Client} from 'app/api';
import {Organization, OnboardingTaskKey} from 'app/types';
import {updateOnboardingTask} from 'app/actionCreators/onboardingTasks';

type Props = {
  api: Client;
  organization: Organization;
  location: Location;
  children: React.ReactNode;
};

type State = {
  dismissed: boolean;
};

class OnboardingHovercard extends React.Component<Props, State> {
  state: State = {
    dismissed: false,
  };

  get shouldShowHovercard() {
    const {organization} = this.props;
    const {dismissed} = this.state;

    const hasCompletedTask = organization.onboardingTasks.find(
      task => task.task === OnboardingTaskKey.ALERT_RULE && task.status === 'complete'
    );

    const query = this.props.location?.query || {};

    return (
      !hasCompletedTask &&
      !dismissed &&
      Object.prototype.hasOwnProperty.call(query, 'onboardingTask')
    );
  }

  skipTask = () => {
    const {api, organization} = this.props;

    updateOnboardingTask(api, organization, {
      task: OnboardingTaskKey.ALERT_RULE,
      status: 'complete',
      data: {accepted_defaults: true},
    });

    this.setState({dismissed: true});
  };

  render() {
    const {children, organization: _org, location: _location, ...props} = this.props;

    if (!this.shouldShowHovercard) {
      return children;
    }

    const hovercardBody = (
      <HovercardBody>
        <h1>{t('Configure custom alerting')}</h1>

        <p>
          {t(
            `Add custom alert rules to configure under what conditions
             you receive notifications from Sentry.`
          )}
        </p>

        <Button size="xsmall" onClick={this.skipTask}>
          {t('The default rule looks good!')}
        </Button>
      </HovercardBody>
    );

    return (
      <Hovercard show position="left" body={hovercardBody} {...props}>
        {children}
      </Hovercard>
    );
  }
}

const HovercardBody = styled('div')`
  h1 {
    font-size: ${p => p.theme.fontSizeLarge};
    margin-bottom: ${space(1.5)};
  }
  p {
    font-size: ${p => p.theme.fontSizeMedium};
  }
`;

export default withApi(OnboardingHovercard);
