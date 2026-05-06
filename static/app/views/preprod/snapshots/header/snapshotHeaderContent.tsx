import * as Layout from 'sentry/components/layouts/thirds';
import {PageHeadingQuestionTooltip} from 'sentry/components/pageHeadingQuestionTooltip';
import {t} from 'sentry/locale';
import {TopBar} from 'sentry/views/navigation/topBar';

export function SnapshotHeaderContent() {
  return (
    <Layout.HeaderContent unified>
      <Layout.Title>
        <TopBar.Slot name="title">
          {t('Snapshots')}
          <PageHeadingQuestionTooltip
            docsUrl="https://docs.sentry.io/product/preprod/snapshots/"
            title={t('Catch visual regressions before they reach users.')}
          />
        </TopBar.Slot>
      </Layout.Title>
    </Layout.HeaderContent>
  );
}
