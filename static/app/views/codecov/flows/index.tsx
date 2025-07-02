import DropdownButton from 'sentry/components/dropdownButton';
import type {MenuItemProps} from 'sentry/components/dropdownMenu';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import * as Layout from 'sentry/components/layouts/thirds';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import useLoadReplayReader from 'sentry/utils/replays/hooks/useLoadReplayReader';
import {FLOWS_PAGE_TITLE} from 'sentry/views/codecov/settings';

import {sampleFlows} from './flowInstances/data/data';
import FlowsTable from './flowsTable';
import FlowsTabs from './tabs';

export default function FlowsPage() {
  const replaySlug = 'acd5d72f6ba54385ac80abe9dfadb142';
  const orgSlug = 'codecov';

  const readerResult = useLoadReplayReader({
    replaySlug,
    orgSlug,
  });
  const {replay, replayRecord} = readerResult;

  console.log({replay});
  console.log({replayRecord});

  const response = {
    data: sampleFlows,
    isLoading: false,
    error: null,
  };

  return (
    <SentryDocumentTitle title={FLOWS_PAGE_TITLE}>
      <Layout.Header>
        <Layout.HeaderContent>
          <Layout.Title>{t('Flows')}</Layout.Title>
        </Layout.HeaderContent>
        <Layout.HeaderActions>
          <DropdownMenu
            items={getWebItems()}
            trigger={(triggerProps, isOpen) => (
              <DropdownButton {...triggerProps} isOpen={isOpen} size="sm">
                {t('Create Flow')}
              </DropdownButton>
            )}
          />
        </Layout.HeaderActions>
        <FlowsTabs selected="flow-definitions" />
      </Layout.Header>
      <PageFiltersContainer>
        <Layout.Body>
          <Layout.Main fullWidth>
            <FlowsTable response={response} />
          </Layout.Main>
        </Layout.Body>
      </PageFiltersContainer>
    </SentryDocumentTitle>
  );
}

function getWebItems(): MenuItemProps[] {
  return [
    {
      key: 'from-replay',
      label: t('From existing session replay'),
      textValue: 'from existing session replay',
      onAction: () => {
        const detailUrl = `/codecov/flows/new/`;
        window.location.href = detailUrl;
      },
    },
    {
      key: 'from-production',
      label: t('From production'),
      textValue: 'from production',
    },
  ] satisfies MenuItemProps[];
}
