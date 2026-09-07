import breadcrumbsImg from 'sentry-images/spot/breadcrumbs-generic.svg';
import docsImg from 'sentry-images/spot/code-arguments-tags-mirrored.svg';
import releasesImg from 'sentry-images/spot/releases.svg';

import {Container, Grid} from '@sentry/scraps/layout';

import * as Layout from 'sentry/components/layouts/thirds';
import {ResourceCard} from 'sentry/components/resourceCard';
import {t} from 'sentry/locale';

export function Resources() {
  return (
    <Container borderTop="primary" padding="xl 3xl">
      <Layout.Title>{t('Resources')}</Layout.Title>
      <Grid
        columns={{
          zero: 'minmax(100px, 1fr)',
          '3xl': 'repeat(auto-fit, minmax(100px, 1fr))',
        }}
        gap="2xl"
      >
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
      </Grid>
    </Container>
  );
}
