import {FeatureBadge} from '@sentry/scraps/badge';
import {Flex, Stack} from '@sentry/scraps/layout';

import * as Layout from 'sentry/components/layouts/thirds';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';
import {ConventionEditForm} from 'sentry/views/codeConventions/conventionEditForm';

const EMPTY_CONVENTION = {name: ''};

export default function NewConvention() {
  const organization = useOrganization();

  return (
    <SentryDocumentTitle
      title={`${t('New Convention')} — ${t('Code Quality')}`}
      orgSlug={organization.slug}
    >
      <Stack flex={1}>
        <Layout.Title>
          <Flex align="center" gap="sm">
            {t('New Convention')}
            <FeatureBadge type="alpha" />
          </Flex>
        </Layout.Title>
        <Layout.Body>
          <Layout.Main width="full">
            <ConventionEditForm convention={EMPTY_CONVENTION} />
          </Layout.Main>
        </Layout.Body>
      </Stack>
    </SentryDocumentTitle>
  );
}
