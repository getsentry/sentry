import React from 'react';
import {Flex} from 'grid-emotion';
import styled from 'react-emotion';

import analytics from 'app/utils/analytics';
import ResourceCard from 'app/components/resourceCard';
import SentryTypes from 'app/proptypes';
import ErrorRobot from 'app/components/errorRobot';
import {Panel} from 'app/components/panels';
import {t} from 'app/locale';

export default class Resources extends React.Component {
  static propTypes = {
    org: SentryTypes.Organization,
    project: SentryTypes.Project,
  };

  componentDidMount() {
    analytics('orgdash.resources_shown');
  }

  render() {
    return (
      <ResourcesWrapper>
        <RobotPanel>
          <ErrorRobot org={this.props.org} project={this.props.project} />
        </RobotPanel>
        <ResourcesSection>
          <h4>{t('Resources')}</h4>
          <Flex justify={'space-between'}>
            <Flex width={3 / 10}>
              <ResourceCard
                link={'https://blog.sentry.io/2018/03/06/the-sentry-workflow'}
                imgUrl={'images/releases.svg'}
                title={'The Sentry Workflow'}
              />
            </Flex>
            <Flex width={3 / 10}>
              <ResourceCard
                link={'https://sentry.io/vs/logging/'}
                imgUrl={'images/breadcrumbs-generic.svg'}
                title={'Sentry vs Logging'}
              />
            </Flex>
            <Flex width={3 / 10}>
              <ResourceCard
                link={'https://docs.sentry.io/'}
                imgUrl={'images/code-arguments-tags-mirrored.svg'}
                title={'Docs'}
              />
            </Flex>
          </Flex>
        </ResourcesSection>
      </ResourcesWrapper>
    );
  }
}

const ResourcesWrapper = styled('div')`
  border-top: 1px solid ${p => p.theme.borderLight};
`;

const RobotPanel = styled(Panel)`
  margin: 30px 30px 20px 30px;
`;

const ResourcesSection = styled('div')`
  padding: 0 30px 20px 30px;
`;
