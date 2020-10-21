import { Component } from 'react';
import styled from '@emotion/styled';

import {Organization} from 'app/types';
import {trackAnalyticsEvent} from 'app/utils/analytics';
import PageHeading from 'app/components/pageHeading';
import ResourceCard from 'app/components/resourceCard';
import space from 'app/styles/space';
import {t} from 'app/locale';

import releasesImg from '../../../images/spot/releases.svg';
import breadcrumbsImg from '../../../images/spot/breadcrumbs-generic.svg';
import docsImg from '../../../images/spot/code-arguments-tags-mirrored.svg';

type Props = {
  organization: Organization;
};

class Resources extends Component<Props> {
  componentDidMount() {
    const {organization} = this.props;
    trackAnalyticsEvent({
      eventKey: 'orgdash.resources_shown',
      eventName: 'Projects Dashboard: Resources Shown',
      organization: organization.id,
    });
  }

  render() {
    return (
      <ResourcesWrapper data-test-id="resources">
        <PageHeading withMargins>{t('Resources')}</PageHeading>
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

export default Resources;

const ResourcesWrapper = styled('div')`
  border-top: 1px solid ${p => p.theme.borderLight};
  padding: 25px 30px 10px 30px;
`;

const ResourceCards = styled('div')`
  display: grid;
  grid-template-columns: minmax(100px, 1fr);
  grid-gap: ${space(3)};

  @media (min-width: ${p => p.theme.breakpoints[1]}) {
    grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
  }
`;
