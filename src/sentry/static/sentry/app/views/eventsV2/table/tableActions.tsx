import React from 'react';
import {Location} from 'history';

import Feature from 'app/components/acl/feature';
import FeatureDisabled from 'app/components/acl/featureDisabled';
import GuideAnchor from 'app/components/assistant/guideAnchor';
import Button from 'app/components/button';
import DataExport, {ExportQueryType} from 'app/components/dataExport';
import Hovercard from 'app/components/hovercard';
import {IconDownload, IconStack, IconTag} from 'app/icons';
import {t} from 'app/locale';
import {OrganizationSummary} from 'app/types';
import {trackAnalyticsEvent} from 'app/utils/analytics';
import {TableData} from 'app/utils/discover/discoverQuery';
import EventView from 'app/utils/discover/eventView';

import {downloadAsCsv} from '../utils';

type Props = {
  isLoading: boolean;
  title: string;
  organization: OrganizationSummary;
  eventView: EventView;
  tableData: TableData | null | undefined;
  location: Location;
  onEdit: () => void;
  onChangeShowTags: () => void;
  showTags: boolean;
};

function handleDownloadAsCsv(title: string, {organization, eventView, tableData}: Props) {
  trackAnalyticsEvent({
    eventKey: 'discover_v2.results.download_csv',
    eventName: 'Discoverv2: Download CSV',
    organization_id: parseInt(organization.id, 10),
  });
  downloadAsCsv(tableData, eventView.getColumns(), title);
}

function renderDownloadButton(canEdit: boolean, props: Props) {
  return (
    <Feature
      features={['organizations:discover-query']}
      renderDisabled={() => renderBrowserExportButton(canEdit, props)}
    >
      {renderAsyncExportButton(canEdit, props)}
    </Feature>
  );
}

function renderBrowserExportButton(canEdit: boolean, {isLoading, ...props}: Props) {
  const disabled = isLoading || canEdit === false;
  const onClick = disabled
    ? undefined
    : () => handleDownloadAsCsv(props.title, {isLoading, ...props});

  return (
    <Button
      size="small"
      disabled={disabled}
      onClick={onClick}
      data-test-id="grid-download-csv"
      icon={<IconDownload size="xs" />}
    >
      {t('Export')}
    </Button>
  );
}

function renderAsyncExportButton(canEdit: boolean, props: Props) {
  const {isLoading, location} = props;
  const disabled = isLoading || canEdit === false;
  return (
    <DataExport
      payload={{
        queryType: ExportQueryType.Discover,
        queryInfo: location.query,
      }}
      disabled={disabled}
      icon={<IconDownload size="xs" />}
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
        size="small"
        disabled={!canEdit}
        onClick={onClick}
        data-test-id="grid-edit-enable"
        icon={<IconStack size="xs" />}
      >
        {t('Columns')}
      </Button>
    </GuideAnchor>
  );
}
// Placate eslint proptype checking

function renderSummaryButton({onChangeShowTags, showTags}: Props) {
  return (
    <Button size="small" onClick={onChangeShowTags} icon={<IconTag size="xs" />}>
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

  const renderDisabled = p => (
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

function HeaderActions(props: Props) {
  return (
    <React.Fragment>
      <FeatureWrapper {...props} key="edit">
        {renderEditButton}
      </FeatureWrapper>
      <FeatureWrapper {...props} key="download">
        {renderDownloadButton}
      </FeatureWrapper>
      {renderSummaryButton(props)}
    </React.Fragment>
  );
}

export default HeaderActions;
