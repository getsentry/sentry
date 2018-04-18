import React from 'react';
import {Flex} from 'grid-emotion';
import ResourceCard from '../../components/resourceCard';
import SentryTypes from '../../proptypes';
import ErrorRobot from '../../components/errorRobot';
import {Panel} from '../../components/panels';
import {t} from '../../locale';

export default class Resources extends React.Component {
  static propTypes = {
    org: SentryTypes.Organization,
    project: SentryTypes.Project,
  };

  render() {
    return (
      <React.Fragment>
        <Panel>
          <ErrorRobot org={this.props.org} project={this.props.project} />
        </Panel>
        <div>
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
        </div>
      </React.Fragment>
    );
  }
}
