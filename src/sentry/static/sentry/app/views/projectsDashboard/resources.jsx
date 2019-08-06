import React from 'react';
import {Flex} from 'grid-emotion';
import styled from 'react-emotion';

import {analytics} from 'app/utils/analytics';
import ResourceCard from 'app/components/resourceCard';
import {t} from 'app/locale';

import releasesImg from '../../../images/releases.svg';
import breadcrumbsImg from '../../../images/breadcrumbs-generic.svg';
import docsImg from '../../../images/code-arguments-tags-mirrored.svg';

export default class Resources extends React.Component {
  componentDidMount() {
    analytics('orgdash.resources_shown');
  }

  render() {
    return (
      <ResourcesWrapper>
        <ResourcesSection>
          <h4>{t('Resources')}</h4>
          <Flex justify="space-between">
            <Flex width={3 / 10}>
              <ResourceCard
                link="https://blog.sentry.io/2018/03/06/the-sentry-workflow"
                imgUrl={releasesImg}
                title="The Sentry Workflow"
              />
            </Flex>
            <Flex width={3 / 10}>
              <ResourceCard
                link="https://sentry.io/vs/logging/"
                imgUrl={breadcrumbsImg}
                title="Sentry vs Logging"
              />
            </Flex>
            <Flex width={3 / 10}>
              <ResourceCard
                link="https://docs.sentry.io/"
                imgUrl={docsImg}
                title="Docs"
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
  padding-top: 20px;
`;

const ResourcesSection = styled('div')`
  padding: 0 30px 20px 30px;
`;
