import React from 'react';
import styled from '@emotion/styled';

import {analytics} from 'app/utils/analytics';
import PageHeading from 'app/components/pageHeading';
import ResourceCard from 'app/components/resourceCard';
import space from 'app/styles/space';
import {t} from 'app/locale';

import releasesImg from '../../../images/spot/releases.svg';
import breadcrumbsImg from '../../../images/spot/breadcrumbs-generic.svg';
import docsImg from '../../../images/spot/code-arguments-tags-mirrored.svg';

export default class Resources extends React.Component {
  componentDidMount() {
    analytics('orgdash.resources_shown');
  }

  render() {
    return (
      <ResourcesWrapper data-test-id="resources">
        <PageHeading>{t('Resources')}</PageHeading>
        <ResourceCards>
          <ResourceCard
            link="https://blog.sentry.io/2018/03/06/the-sentry-workflow"
            imgUrl={releasesImg}
            title={t('The Sentry Workflow')}
          />
          <ResourceCard
            link="https://sentry.io/vs/logging/"
            imgUrl={breadcrumbsImg}
            title={t('Sentry vs Logging')}
          />
          <ResourceCard
            link="https://docs.sentry.io/"
            imgUrl={docsImg}
            title={t('Docs')}
          />
        </ResourceCards>
      </ResourcesWrapper>
    );
  }
}

const ResourcesWrapper = styled('div')`
  border-top: 1px solid ${p => p.theme.borderLight};
  padding: 25px 30px 10px 30px;
`;

const ResourceCards = styled('div')`
  display: grid;
  grid-template-columns: repeat(3, auto);
  grid-gap: ${space(4)};
  margin-top: ${space(3)};
`;
