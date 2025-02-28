import {Button} from 'sentry/components/button';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {QuickTraceMetaBase} from 'sentry/views/performance/transactionDetails/quickTraceMeta';

import {openUpsellModal} from 'getsentry/actionCreators/modal';

type Props = {
  organization: Organization;
};

export default function DisabledQuickTrace({organization}: Props) {
  return (
    <QuickTraceMetaBase
      body={t('Missing Trace')}
      footer={
        <Button
          priority="link"
          onClick={() =>
            openUpsellModal({
              organization,
              source: 'quick-trace',
            })
          }
        >
          {t('Learn More')}
        </Button>
      }
    />
  );
}
