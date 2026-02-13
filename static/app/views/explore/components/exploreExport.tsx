import type React from 'react';

import {Button} from '@sentry/scraps/button';

import DataExport, {ExportQueryType} from 'sentry/components/dataExport';
import {IconDownload} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import useOrganization from 'sentry/utils/useOrganization';
import {TraceItemDataset} from 'sentry/views/explore/types';

interface QueryInfo {
  field: string[];
  project: number[];
  query: string;
  sort: string[];
  end?: string;
  environment?: string[];
  start?: string;
  statsPeriod?: string;
}

type BaseExploreExportProps = {
  disabled: boolean;
  hasReachedCSVLimit: boolean;
  isDataEmpty: boolean;
  isDataError: boolean;
  isDataLoading: boolean;
  downloadAsCsv?: () => void;
};

type LogsExploreExportProps = BaseExploreExportProps & {
  queryInfo: QueryInfo;
  traceItemDataset: TraceItemDataset.LOGS;
};

type OtherExploreExportProps = BaseExploreExportProps & {
  queryInfo: any;
  traceItemDataset: Exclude<TraceItemDataset, TraceItemDataset.LOGS>;
};

type ExploreExportProps = LogsExploreExportProps | OtherExploreExportProps;

function getDisabledTooltip(
  props: ExploreExportProps,
  _organization: Organization
): string | undefined {
  if (props.isDataLoading) {
    return t('Loading...');
  }
  if (props.isDataError) {
    return t('Unable to export due to an error');
  }
  if (props.isDataEmpty) {
    return t('No data to export');
  }
  return undefined;
}

export function ExploreExport(props: LogsExploreExportProps): React.ReactElement;
export function ExploreExport(props: OtherExploreExportProps): React.ReactElement;
export function ExploreExport(props: ExploreExportProps) {
  const organization = useOrganization();

  const disabledTooltip = getDisabledTooltip(props, organization);
  const disabled = props.disabled || !!disabledTooltip;

  const handleExport = () => {
    trackAnalytics('explore.table_exported', {
      organization,
      traceItemDataset: props.traceItemDataset,
      ...props.queryInfo,
      export_type: 'browser_csv',
    });

    if (props.downloadAsCsv) {
      props.downloadAsCsv();
    }
  };

  if (!props.hasReachedCSVLimit) {
    return (
      <Button
        size="xs"
        disabled={disabled}
        onClick={handleExport}
        data-test-id="export-download-csv"
        icon={<IconDownload />}
        tooltipProps={{
          title: disabled
            ? disabledTooltip
            : t(
                "There aren't that many results, start your export and it'll download immediately."
              ),
        }}
      >
        {t('Export')}
      </Button>
    );
  }

  return (
    <DataExport
      size="xs"
      payload={{
        queryType: ExportQueryType.EXPLORE,
        queryInfo: {
          ...props.queryInfo,
          dataset: props.traceItemDataset,
        },
      }}
      disabled={disabled}
      overrideFeatureFlags
      icon={<IconDownload />}
      onClick={() => {
        trackAnalytics('explore.table_exported', {
          organization,
          traceItemDataset: props.traceItemDataset,
          ...props.queryInfo,
          export_type: 'download',
        });
      }}
    >
      {t('Export')}
    </DataExport>
  );
}
