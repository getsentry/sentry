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

  const [_rules, setRules] = useState<SamplingRules>([]);
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
            <RulesPanel
              headers={['', t('Operator'), t('Condition'), t('Rate'), t('Active'), '']}
            >
              <Promo />
            </RulesPanel>
          )}
        </Access>
      </Fragment>
    </SentryDocumentTitle>
  );
}

const RulesPanel = styled(PanelTable)`
  overflow: visible;

  > * {
    ${p => p.theme.overflowEllipsis};

    :not(:last-child) {
      border-bottom: 1px solid ${p => p.theme.border};
    }

    :nth-child(-n + 6):nth-child(6n - 1) {
      text-align: right;
    }

    @media (max-width: ${p => p.theme.breakpoints.small}) {
      :nth-child(6n - 1),
      :nth-child(6n - 4),
      :nth-child(6n - 5) {
        display: none;
      }
    }
  }

  grid-template-columns: 1fr 0.5fr 66px;

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    grid-template-columns: 48px 95px 1fr 0.5fr 77px 66px;
  }

  @media (min-width: ${p => p.theme.breakpoints.large}) {
    grid-template-columns: 48px 95px 1.5fr 1fr 77px 124px;
  }

  @media (min-width: ${p => p.theme.breakpoints.xlarge}) {
    grid-template-columns: 48px 95px 1fr 0.5fr 77px 124px;
  }
`;
