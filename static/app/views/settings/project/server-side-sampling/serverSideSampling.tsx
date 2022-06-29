import {Fragment, useEffect, useState} from 'react';
import styled from '@emotion/styled';
import partition from 'lodash/partition';

import Access from 'sentry/components/acl/access';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {PanelTable} from 'sentry/components/panels';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {SamplingRules, SamplingRuleType} from 'sentry/types/sampling';
import handleXhrErrorResponse from 'sentry/utils/handleXhrErrorResponse';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import TextBlock from 'sentry/views/settings/components/text/textBlock';
import PermissionAlert from 'sentry/views/settings/organization/permissionAlert';

import {Promo} from './promo';

export function ServerSideSampling() {
  const api = useApi();
  const organization = useOrganization();
  const params = useParams();

  const {orgId: orgSlug, projectId: projectSlug} = params;

  const [rules, setRules] = useState<SamplingRules>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    async function fetchRules() {
      try {
        const projectDetails = await api.requestPromise(
          `/projects/${orgSlug}/${projectSlug}/`
        );

        const {dynamicSampling} = projectDetails;
        const samplingRules: SamplingRules = dynamicSampling?.rules ?? [];

        const transactionRules = samplingRules.filter(
          samplingRule =>
            samplingRule.type === SamplingRuleType.TRANSACTION ||
            samplingRule.type === SamplingRuleType.TRACE
        );

        const [rulesWithoutConditions, rulesWithConditions] = partition(
          transactionRules,
          transactionRule => !transactionRule.condition.inner.length
        );

        setRules([...rulesWithConditions, ...rulesWithoutConditions]);
        setLoading(false);
      } catch (err) {
        const errorMessage = t('Unable to load sampling rules');
        handleXhrErrorResponse(errorMessage)(err);
        setError(errorMessage);
        setLoading(false);
      }
    }
    fetchRules();
  }, [api, projectSlug, orgSlug]);

  return (
    <SentryDocumentTitle title={t('Server-side Sampling')}>
      <Fragment>
        <SettingsPageHeader title={t('Server-side Sampling')} />
        <TextBlock>
          {t(
            'Server-side sampling provides an additional dial for dropping transactions. This comes in handy when your server-side sampling rules target the transactions you want to keep, but you need more of those transactions being sent by the SDK.'
          )}
        </TextBlock>
        <PermissionAlert />
        <Access organization={organization} access={['project:write']}>
          {error && <LoadingError message={error} />}
          {!error && loading && <LoadingIndicator />}
          {!error && !loading && (
            <PanelTable
              headers={['', t('Operator'), t('Condition'), t('Rate'), t('Active'), '']}
            >
              <Promo />
            </PanelTable>
          )}
        </Access>
      </Fragment>
    </SentryDocumentTitle>
  );
}
