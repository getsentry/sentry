import {Fragment, useState} from 'react';

import {Button} from 'sentry/components/button';
import GridEditable from 'sentry/components/gridEditable';
import ExternalLink from 'sentry/components/links/externalLink';
import {t, tct} from 'sentry/locale';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import TextBlock from 'sentry/views/settings/components/text/textBlock';

const PAGE_SIZE = 20;

type AuditLog = {
  action: string;
  createdAt: string;
  flag: string;
  provider: string;
};

type AuditLogResponse = {
  data: AuditLog[];
};

export function OrganizationFeatureFlagsAuditLogTable() {
  const organization = useOrganization();

  const [page, setPage] = useState(0);

  const {
    data: responseData,
    isLoading,
    isError,
  } = useApiQuery<AuditLogResponse>(
    [
      `/organizations/${organization.slug}/flags/logs/`,
      {
        query: {
          sort: '-createdAt',
          per_page: PAGE_SIZE,
          cursor: `${PAGE_SIZE}:${page}:0`,
        },
      },
    ],
    {
      // TODO:
      refetchInterval: 10_000,
      staleTime: 0,
      enabled: true,
    }
  );

  return (
    <Fragment>
      <TextBlock>{t('Audit Logs (make this a header)')}</TextBlock>
      <TextBlock>
        {tct('Blah blah heres a [link:link].', {
          link: (
            <ExternalLink href="https://docs.sentry.io/product/explore/feature-flags/#change-tracking" />
          ),
        })}
      </TextBlock>

      <GridEditable
        error={isError}
        isLoading={isLoading}
        data={responseData?.data ?? []}
        columnOrder={[
          {key: 'provider', name: t('Provider'), width: 150},
          {key: 'flag', name: t('Feature Flag'), width: 400},
          {key: 'action', name: t('Action'), width: 100},
          {key: 'createdAt', name: t('Created'), width: 400},
        ]}
        columnSortBy={[]}
        grid={{}}
      />

      <Button onClick={() => setPage(page - 1)} disabled={page <= 0}>
        Prev
      </Button>
      <Button onClick={() => setPage(page + 1)}>Next</Button>
    </Fragment>
  );
}

export default OrganizationFeatureFlagsAuditLogTable;
