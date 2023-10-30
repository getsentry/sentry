import styled from '@emotion/styled';

import breadcrumbsImg from 'sentry-images/spot/breadcrumbs-generic.svg';
import docsImg from 'sentry-images/spot/code-arguments-tags-mirrored.svg';
import releasesImg from 'sentry-images/spot/releases.svg';

import * as Layout from 'sentry/components/layouts/thirds';
import ResourceCard from 'sentry/components/resourceCard';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Organization} from 'sentry/types';

type Props = {
  organization: Organization;
};

function Resources(_props: Props) {
  return (
    <ResourcesWrapper data-test-id="resources">
      <Layout.Title withMargins>{t('Resources')}</Layout.Title>
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
  padding: ${space(2)} ${space(4)};
`;

const ResourceCards = styled('div')`
  display: grid;
  grid-template-columns: minmax(100px, 1fr);
  gap: ${space(3)};

  @media (min-width: ${p => p.theme.breakpoints.medium}) {
    grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
  }
`;
