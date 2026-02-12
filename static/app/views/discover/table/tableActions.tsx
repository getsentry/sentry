import {Fragment} from 'react';
import type {Location} from 'history';

import {Button} from '@sentry/scraps/button';

import Feature from 'sentry/components/acl/feature';
import FeatureDisabled from 'sentry/components/acl/featureDisabled';
import GuideAnchor from 'sentry/components/assistant/guideAnchor';
import DataExport, {ExportQueryType} from 'sentry/components/dataExport';
import {Hovercard} from 'sentry/components/hovercard';
import {IconDownload, IconSliders, IconTag} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {OrganizationSummary} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import type {TableData} from 'sentry/utils/discover/discoverQuery';
import type EventView from 'sentry/utils/discover/eventView';
import {SavedQueryDatasets} from 'sentry/utils/discover/types';
import {downloadAsCsv} from 'sentry/views/discover/utils';

type Props = {
  error: string | null;
  eventView: EventView;
  isLoading: boolean;
  location: Location;
  onChangeShowTags: () => void;
  onEdit: () => void;
  organization: OrganizationSummary;
  showTags: boolean;
  tableData: TableData | null | undefined;
  title: string;
  queryDataset?: SavedQueryDatasets;
};

function handleDownloadAsCsv(title: string, {organization, eventView, tableData}: Props) {
  trackAnalytics('discover_v2.results.download_csv', {
    organization: organization.id, // org summary
  });
  downloadAsCsv(tableData, eventView.getColumns(), title);
}

function renderDownloadButton(canEdit: boolean, props: Props) {
  const {tableData} = props;
  return (
    <Feature
      features="organizations:discover-query"
      renderDisabled={() => renderBrowserExportButton(canEdit, props)}
    >
      {tableData?.data && tableData.data.length < 50
        ? renderBrowserExportButton(canEdit, props)
        : renderAsyncExportButton(canEdit, props)}
    </Feature>
  );
}

function renderBrowserExportButton(canEdit: boolean, props: Props) {
  const {isLoading, error} = props;
  const disabled = isLoading || error !== null || canEdit === false;
  const onClick = disabled ? undefined : () => handleDownloadAsCsv(props.title, props);

  return (
    <Button
      size="sm"
      disabled={disabled}
      onClick={onClick}
      data-test-id="grid-download-csv"
      icon={<IconDownload />}
      tooltipProps={{
        title: disabled
          ? undefined
          : t(
              "There aren't that many results, start your export and it'll download immediately."
            ),
      }}
    >
      {t('Export All')}
    </Button>
  );
}

function renderAsyncExportButton(canEdit: boolean, props: Props) {
  const {isLoading, error, location, eventView} = props;
  const disabled = isLoading || error !== null || canEdit === false;
  return (
    <DataExport
      payload={{
        queryType: ExportQueryType.DISCOVER,
        queryInfo: eventView.getEventsAPIPayload(location),
      }}
      disabled={disabled}
      icon={<IconDownload />}
    >
      {t('Export All')}
    </DataExport>
  );
}

// Placate eslint proptype checking

function renderEditButton(canEdit: boolean, props: Props) {
  const onClick = canEdit ? props.onEdit : undefined;
  return (
    <GuideAnchor target="columns_header_button">
      <Button
        size="sm"
        disabled={!canEdit}
        onClick={onClick}
        data-test-id="grid-edit-enable"
        icon={<IconSliders />}
      >
        {t('Columns')}
      </Button>
    </GuideAnchor>
  );
}

// Placate eslint proptype checking

function renderSummaryButton({onChangeShowTags, showTags}: Props) {
  return (
    <Button size="sm" onClick={onChangeShowTags} icon={<IconTag />}>
      {showTags ? t('Hide Tags') : t('Show Tags')}
    </Button>
  );
}

type FeatureWrapperProps = Props & {
  children: (hasFeature: boolean, props: Props) => React.ReactNode;
};

function FeatureWrapper(props: FeatureWrapperProps) {
  const noEditMessage = t('Requires discover query feature.');
  const editFeatures = ['organizations:discover-query'];

  const renderDisabled = (p: any) => (
    <Hovercard
      body={
        <FeatureDisabled
          features={p.features}
          hideHelpToggle
          message={noEditMessage}
          featureName={noEditMessage}
        />
      }
    >
      {p.children(p)}
    </Hovercard>
  );
  return (
    <Feature
      hookName="feature-disabled:grid-editable-actions"
      renderDisabled={renderDisabled}
      features={editFeatures}
    >
      {({hasFeature}) => props.children(hasFeature, props)}
    </Feature>
  );
}

function TableActions(props: Props) {
  return (
    <Fragment>
      <FeatureWrapper {...props} key="edit">
        {renderEditButton}
      </FeatureWrapper>
      <FeatureWrapper {...props} key="download">
        {renderDownloadButton}
      </FeatureWrapper>
      {renderSummaryButton(props)}
    </Fragment>
  );
}

export default TableActions;
