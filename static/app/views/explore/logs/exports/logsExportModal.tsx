import {useMemo} from 'react';
import {z} from 'zod';

import {Button} from '@sentry/scraps/button';
import {defaultFormOptions, useScrapsForm, useStore} from '@sentry/scraps/form';
import {Flex, Stack} from '@sentry/scraps/layout';
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

const exportModalFormSchema = z.object({
  columns: z.enum(['all', 'selected']),
  format: z.enum(['csv', 'jsonl']),
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
  const handleDataExport = useDataExport();
  const {rowCountDefault, rowCountOptions} =
    generateLogExportRowCountOptions(estimatedRowCount);
  const defaultValues: ExportModalFormValues = {
    columns: 'selected',
    format: 'csv',
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
      const format = isAllColumns ? 'jsonl' : value.format;
      const passedSyncLimit = value.limit > ROW_COUNT_VALUE_SYNC_LIMIT;

      trackAnalytics('explore.table_exported', {
        organization,
        traceItemDataset: TraceItemDataset.LOGS,
        ...queryInfo,
        export_row_limit: value.limit,
        export_file_format: format,
        export_type: isAllColumns || passedSyncLimit ? 'export_download' : 'browser_sync',
      });

      if (isAllColumns || passedSyncLimit) {
        await handleDataExport({
          format,
          queryInfo: isAllColumns ? {...payload.queryInfo, field: []} : payload.queryInfo,
          queryType: isAllColumns
            ? ExportQueryType.TRACE_ITEM_FULL_EXPORT
            : ExportQueryType.EXPLORE,
          limit: value.limit,
        });
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
            {columnsValue === 'all'
              ? t('Your file will be sent to your email address.')
              : t(
                  'If you select more than %s rows your file will be sent to your email address.',
                  formatNumber(ROW_COUNT_VALUE_SYNC_LIMIT)
                )}
          </Text>
          <form.AppField name="columns">
            {field => (
              <field.Radio.Group
                value={field.state.value}
                onChange={value =>
                  field.handleChange(value as ExportModalFormValues['columns'])
                }
              >
                <field.Layout.Stack label={t('Columns')}>
                  <field.Radio.Item value="selected">
                    {t('Selected columns')}
                  </field.Radio.Item>
                  <field.Radio.Item value="all">{t('All columns')}</field.Radio.Item>
                </field.Layout.Stack>
              </field.Radio.Group>
            )}
          </form.AppField>
          {columnsValue === 'all' ? (
            <Stack gap="xs">
              <Text bold size="sm">
                {t('Format')}
              </Text>
              <Text>{t('JSONL')}</Text>
            </Stack>
          ) : (
            <form.AppField name="format">
              {field => (
                <field.Radio.Group
                  value={field.state.value}
                  onChange={value =>
                    field.handleChange(value as ExportModalFormValues['format'])
                  }
                >
                  <field.Layout.Stack label={t('Format')}>
                    <field.Radio.Item value="csv">{t('CSV')}</field.Radio.Item>
                    <field.Radio.Item value="jsonl">{t('JSONL')}</field.Radio.Item>
                  </field.Layout.Stack>
                </field.Radio.Group>
              )}
            </form.AppField>
          )}
          <form.AppField name="limit">
            {field => (
              <field.Layout.Stack label={t('Number of rows')}>
                <field.Select
                  disabled={rowCountOptions.length === 1}
                  options={rowCountOptions}
                  onChange={field.handleChange}
                  value={field.state.value}
                  defaultValue={rowCountDefault}
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
