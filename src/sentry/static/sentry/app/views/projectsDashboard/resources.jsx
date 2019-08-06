import React from 'react';
import {Flex} from 'grid-emotion';
import styled from 'react-emotion';

import {analytics} from 'app/utils/analytics';
import PageHeading from 'app/components/pageHeading';
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
          <PageHeading>{t('Resources')}</PageHeading>
          <ResourceCards>
            <ResourceCard
              link="https://blog.sentry.io/2018/03/06/the-sentry-workflow"
              imgUrl={releasesImg}
              title="The Sentry Workflow"
            />
            <ResourceCard
              link="https://sentry.io/vs/logging/"
              imgUrl={breadcrumbsImg}
              title="Sentry vs Logging"
            />
            <ResourceCard link="https://docs.sentry.io/" imgUrl={docsImg} title="Docs" />
          </ResourceCards>
        </ResourcesSection>
      </ResourcesWrapper>
    );
  }
}

const ResourcesWrapper = styled('div')`
  border-top: 1px solid ${p => p.theme.borderLight};
`;

const ResourcesSection = styled('div')`
  padding: 30px 30px 10px 30px;
`;

const ResourceCards = styled(Flex)`
  display: grid;
  grid-template-columns: repeat(3, auto);
  margin-top: 25px;
  grid-gap: 30px;
`;
