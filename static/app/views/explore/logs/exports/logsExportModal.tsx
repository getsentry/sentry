import {useMemo} from 'react';
import {z} from 'zod';

import {Button} from '@sentry/scraps/button';
import {CompactSelect} from '@sentry/scraps/compactSelect';
import {defaultFormOptions, useScrapsForm, useStore} from '@sentry/scraps/form';
import {Flex, Stack} from '@sentry/scraps/layout';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';
import {Heading, Text} from '@sentry/scraps/text';

import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import type {LogsQueryInfo} from 'sentry/components/exports/dataExport';
import {ExportQueryType, useDataExport} from 'sentry/components/exports/useDataExport';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {formatNumber} from 'sentry/utils/number/formatNumber';
import {useOrganization} from 'sentry/utils/useOrganization';
import {downloadLogs} from 'sentry/views/explore/logs/exports/downloadLogs';
import {
  generateLogExportRowCountOptions,
  ROW_COUNT_VALUE_SYNC_LIMIT,
} from 'sentry/views/explore/logs/exports/generateLogExportRowCountOptions';
import {useLogsExportEstimatedRowCount} from 'sentry/views/explore/logs/exports/useLogsExportEstimatedRowCount';
import type {OurLogsResponseItem} from 'sentry/views/explore/logs/types';
import {TraceItemDataset} from 'sentry/views/explore/types';

enum ModalColumnValue {
  ALL = 'all',
  SELECTED = 'selected',
}

enum ModalColumnFormat {
  CSV = 'csv',
  JSONL = 'jsonl',
}

const exportModalFormSchema = z.object({
  columns: z.enum(ModalColumnValue),
  format: z.enum(ModalColumnFormat),
  limit: z.number(),
});

type ExportModalFormValues = z.infer<typeof exportModalFormSchema>;

type LogsExportModalProps = ModalRenderProps & {
  queryInfo: LogsQueryInfo;
  tableData: OurLogsResponseItem[];
};

export function LogsExportModal({
  Body,
  Footer,
  Header,
  closeModal,
  queryInfo,
  tableData,
}: LogsExportModalProps) {
  const organization = useOrganization();
  const estimatedRowCount = useLogsExportEstimatedRowCount(tableData.length);
  const payload = useMemo(
    () => ({
      queryType: ExportQueryType.EXPLORE,
      queryInfo: {
        ...queryInfo,
        dataset: TraceItemDataset.LOGS,
      },
    }),
    [queryInfo]
  );
  const {mutateAsync: handleDataExport} = useDataExport();
  const {rowCountDefault, rowCountOptions} =
    generateLogExportRowCountOptions(estimatedRowCount);
  const defaultValues: ExportModalFormValues = {
    columns: ModalColumnValue.SELECTED,
    format: ModalColumnFormat.CSV,
    limit: rowCountDefault.value,
  };

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues,
    validators: {
      onDynamic: exportModalFormSchema,
    },
    onSubmit: async ({value}) => {
      const isAllColumns = value.columns === 'all';
      const passedSyncLimit = value.limit > ROW_COUNT_VALUE_SYNC_LIMIT;

      // The backend only supports exporting all columns in JSONL format.
      const format = isAllColumns ? 'jsonl' : value.format;

      trackAnalytics('explore.table_exported', {
        organization,
        traceItemDataset: TraceItemDataset.LOGS,
        query: queryInfo.query,
        sort: queryInfo.sort,
        project: queryInfo.project,
        environment: queryInfo.environment,
        start: queryInfo.start,
        end: queryInfo.end,
        statsPeriod: queryInfo.statsPeriod,
        field: isAllColumns ? undefined : queryInfo.field,
        export_row_limit: value.limit,
        export_file_format: format,
        export_type: isAllColumns || passedSyncLimit ? 'export_download' : 'browser_sync',
      });

      if (isAllColumns || passedSyncLimit) {
        try {
          await handleDataExport({
            format,
            queryInfo: isAllColumns
              ? {...payload.queryInfo, field: []}
              : payload.queryInfo,
            queryType: isAllColumns
              ? ExportQueryType.TRACE_ITEM_FULL_EXPORT
              : ExportQueryType.EXPLORE,
            limit: value.limit,
          });
        } catch {
          // The error message is surfaced by useDataExport's onError handler.
        }
      } else {
        downloadLogs({
          rows: tableData.slice(0, value.limit),
          fields: queryInfo.field,
          filename: 'logs',
          format,
        });
        addSuccessMessage(t('Downloading file to your browser.'));
      }

      closeModal();
    },
  });

  const columnsValue = useStore(form.store, state => state.values.columns);

  return (
    <form.AppForm form={form}>
      <Header closeButton>
        <Heading as="h2">{t('Logs Export')}</Heading>
      </Header>
      <Body>
        <Stack gap="xl">
          <Text>
            {t(
              'If you select more than %s rows or to export all columns of data your file will be sent to your email address.',
              formatNumber(ROW_COUNT_VALUE_SYNC_LIMIT)
            )}
          </Text>
          <form.AppField name="columns">
            {field => (
              <field.Layout.Stack label={t('All Columns?')}>
                <field.Switch
                  checked={field.state.value === ModalColumnValue.ALL}
                  onChange={checked =>
                    field.handleChange(
                      checked ? ModalColumnValue.ALL : ModalColumnValue.SELECTED
                    )
                  }
                />
              </field.Layout.Stack>
            )}
          </form.AppField>
          <form.AppField name="format">
            {field => (
              <field.Radio.Group
                value={
                  columnsValue === ModalColumnValue.ALL
                    ? ModalColumnFormat.JSONL
                    : field.state.value
                }
                onChange={value =>
                  field.handleChange(value as ExportModalFormValues['format'])
                }
                disabled={columnsValue === ModalColumnValue.ALL}
              >
                <field.Layout.Stack label={t('Format')}>
                  <field.Radio.Item value={ModalColumnFormat.CSV}>
                    {t('CSV')}
                  </field.Radio.Item>
                  <field.Radio.Item value={ModalColumnFormat.JSONL}>
                    {t('JSONL')}
                  </field.Radio.Item>
                </field.Layout.Stack>
              </field.Radio.Group>
            )}
          </form.AppField>
          <form.AppField name="limit">
            {field => (
              <field.Layout.Stack label={t('Number of rows')}>
                <CompactSelect
                  disabled={rowCountOptions.length === 1}
                  options={rowCountOptions}
                  value={field.state.value}
                  onChange={option => field.handleChange(option.value)}
                  trigger={triggerProps => (
                    <OverlayTrigger.Button
                      {...triggerProps}
                      aria-label={t('Number of rows')}
                    />
                  )}
                />
              </field.Layout.Stack>
            )}
          </form.AppField>
        </Stack>
      </Body>
      <Footer>
        <Flex gap="xl" justify="end">
          <Button
            variant="secondary"
            onClick={() => {
              trackAnalytics('logs.export_modal', {
                organization,
                action: 'cancel',
                close_reason: 'cancel_button',
              });
              closeModal();
            }}
          >
            {t('Cancel')}
          </Button>
          <form.SubmitButton variant="primary">{t('Export')}</form.SubmitButton>
        </Flex>
      </Footer>
    </form.AppForm>
  );
}
