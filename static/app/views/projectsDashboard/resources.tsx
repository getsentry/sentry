import {useEffect} from 'react';
import styled from '@emotion/styled';

import breadcrumbsImg from 'sentry-images/spot/breadcrumbs-generic.svg';
import docsImg from 'sentry-images/spot/code-arguments-tags-mirrored.svg';
import releasesImg from 'sentry-images/spot/releases.svg';

import PageHeading from 'sentry/components/pageHeading';
import ResourceCard from 'sentry/components/resourceCard';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization} from 'sentry/types';
import {trackAnalyticsEvent} from 'sentry/utils/analytics';

type Props = {
  organization: Organization;
};

function Resources({organization}: Props) {
  useEffect(() => {
    trackAnalyticsEvent({
      eventKey: 'orgdash.resources_shown',
      eventName: 'Projects Dashboard: Resources Shown',
      organization_id: organization.id,
    });
  });

  return (
    <ResourcesWrapper data-test-id="resources">
      <PageHeading withMargins>{t('Resources')}</PageHeading>
      <ResourceCards>
        <ResourceCard
          link="https://docs.sentry.io/product/releases/"
          imgUrl={releasesImg}
          title={t('The Sentry Workflow')}
        />
        <ResourceCard
          link="https://docs.sentry.io/product/issues/"
          imgUrl={breadcrumbsImg}
          title={t('Sentry vs Logging')}
        />
        <ResourceCard link="https://docs.sentry.io/" imgUrl={docsImg} title={t('Docs')} />
      </ResourceCards>
    </ResourcesWrapper>
  );
}

export default Resources;

const ResourcesWrapper = styled('div')`
  border-top: 1px solid ${p => p.theme.border};
  padding: 25px 30px 10px 30px;
`;

const ResourceCards = styled('div')`
  display: grid;
  grid-template-columns: minmax(100px, 1fr);
  gap: ${space(3)};

  @media (min-width: ${p => p.theme.breakpoints.medium}) {
    grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
  }
`;
