import React from 'react';
import PropTypes from 'prop-types';
import styled from '@emotion/styled';
import {Location} from 'history';

import {OrganizationSummary} from 'app/types';
import DataExport, {ExportQueryType} from 'app/components/dataExport';
import Feature from 'app/components/acl/feature';
import FeatureDisabled from 'app/components/acl/featureDisabled';
import {IconDownload, IconEdit} from 'app/icons';
import Hovercard from 'app/components/hovercard';
import {t} from 'app/locale';
import {trackAnalyticsEvent} from 'app/utils/analytics';
import EventView from 'app/utils/discover/eventView';
import space from 'app/styles/space';

import {TableData} from './types';
import {downloadAsCsv} from '../utils';

type Props = {
  isLoading: boolean;
  title: string;
  organization: OrganizationSummary;
  eventView: EventView;
  tableData: TableData | null | undefined;
  location: Location;
  onEdit: () => void;
};

function renderDownloadButton(canEdit: boolean, props: Props) {
  const {tableData} = props;
  if (!tableData || (tableData.data && tableData.data.length < 50)) {
    return renderBrowserExportButton(canEdit, props);
  } else {
    return (
      <Feature
        features={['organizations:data-export']}
        renderDisabled={() => renderBrowserExportButton(canEdit, props)}
      >
        {renderAsyncExportButton(canEdit, props)}
      </Feature>
    );
  }
}

function handleDownloadAsCsv(title: string, {organization, eventView, tableData}: Props) {
  trackAnalyticsEvent({
    eventKey: 'discover_v2.results.download_csv',
    eventName: 'Discoverv2: Download CSV',
    organization_id: parseInt(organization.id, 10),
  });
  downloadAsCsv(tableData, eventView.getColumns(), title);
}

function renderBrowserExportButton(canEdit: boolean, {isLoading, ...props}: Props) {
  const disabled = isLoading || canEdit === false;
  const onClick = disabled
    ? undefined
    : () => handleDownloadAsCsv(props.title, {isLoading, ...props});

  return (
    <HeaderButton disabled={disabled} onClick={onClick} data-test-id="grid-download-csv">
      <IconDownload size="xs" />
      {t('Export Page')}
    </HeaderButton>
  );
}
renderBrowserExportButton.propTypes = {
  title: PropTypes.string,
};

function renderAsyncExportButton(canEdit: boolean, props: Props) {
  const {isLoading, location} = props;
  const disabled = isLoading || canEdit === false;
  return (
    <HeaderDownloadButton
      payload={{
        queryType: ExportQueryType.Discover,
        queryInfo: location.query,
      }}
      disabled={disabled}
    >
      <IconDownload size="xs" />
      {t('Export All')}
    </HeaderDownloadButton>
  );
}
// Placate eslint proptype checking
renderAsyncExportButton.propTypes = {
  isLoading: PropTypes.bool,
};

function renderEditButton(canEdit: boolean, props: Props) {
  const onClick = canEdit ? props.onEdit : undefined;
  return (
    <HeaderButton disabled={!canEdit} onClick={onClick} data-test-id="grid-edit-enable">
      <IconEdit size="xs" />
      {t('Edit Columns')}
    </HeaderButton>
  );
}
// Placate eslint proptype checking
renderEditButton.propTypes = {
  onEdit: PropTypes.func,
};

function HeaderActions(props: Props) {
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
      {({hasFeature}) => (
        <React.Fragment>
          {renderDownloadButton(hasFeature, props)}
          {renderEditButton(hasFeature, props)}
        </React.Fragment>
      )}
    </Feature>
  );
}

const HeaderButton = styled('button')<{disabled?: boolean}>`
  display: flex;
  align-items: center;

  background: none;
  border: none;
  color: ${p => (p.disabled ? p.theme.gray6 : p.theme.gray3)};
  cursor: ${p => (p.disabled ? 'default' : 'pointer')};
  font-size: ${p => p.theme.fontSizeSmall};

  padding: 0;
  margin: 0;
  outline: 0;

  > svg {
    margin-right: ${space(0.5)};
  }

  &:hover,
  &:active {
    color: ${p => (p.disabled ? p.theme.gray6 : p.theme.gray4)};
  }
`;

const HeaderDownloadButton = styled(DataExport)<{disabled: boolean}>`
  background: none;
  border: none;
  font-weight: normal;
  box-shadow: none;
  color: ${p => (p.disabled ? p.theme.gray6 : p.theme.gray3)};

  padding: 0;
  margin: 0;
  outline: 0;

  svg {
    margin-right: ${space(0.5)};
  }
  > span {
    padding: 0;
  }

  &:hover,
  &:active {
    color: ${p => (p.disabled ? p.theme.gray6 : p.theme.gray4)};
    box-shadow: none;
  }
`;

export default HeaderActions;
