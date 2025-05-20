import styled from '@emotion/styled';

import {Alert} from 'sentry/components/core/alert';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {IconLightning} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';

export default function FinishSetupAlert({
  organization,
  projectId,
}: {
  organization: Organization;
  projectId: string;
}) {
  return (
    <Alert
      type="info"
      icon={<IconLightning />}
      trailingItems={
        <LinkButton
          size="xs"
          priority="primary"
          external
          href="https://docs.sentry.io/performance-monitoring/getting-started/"
          onClick={() =>
            trackAnalytics('growth.sample_transaction_docs_link_clicked', {
              project_id: projectId,
              organization,
            })
          }
        >
          {t('Get Started')}
        </LinkButton>
      }
    >
      <TextWrapper>
        {t(
          'You are viewing a sample transaction. Configure performance to start viewing real transactions.'
        )}
      </TextWrapper>
    </Alert>
  );
}

const TextWrapper = styled('span')`
  margin: 0 ${space(1)};
`;
