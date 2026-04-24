import {useMemo} from 'react';
import {z} from 'zod';

import {Button} from '@sentry/scraps/button';
import {defaultFormOptions, useScrapsForm} from '@sentry/scraps/form';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import type {LogsQueryInfo} from 'sentry/components/exports/dataExport';
import {ExportQueryType, useDataExport} from 'sentry/components/exports/useDataExport';
import {t} from 'sentry/locale';
import type {SelectValue} from 'sentry/types/core';
import {formatNumber} from 'sentry/utils/number/formatNumber';
import {QUERY_PAGE_LIMIT} from 'sentry/views/explore/logs/constants';
import {downloadLogs} from 'sentry/views/explore/logs/downloadLogs';
import {useLogsExportEstimatedRowCount} from 'sentry/views/explore/logs/exports/useLogsExportEstimatedRowCount';
import type {OurLogsResponseItem} from 'sentry/views/explore/logs/types';
import {TraceItemDataset} from 'sentry/views/explore/types';

const ROW_COUNT_VALUE_DEFAULT = 100;

/**
 * Keep this in sync with data_export.py on the backend
 */
const ROW_COUNT_VALUE_SYNC_LIMIT = QUERY_PAGE_LIMIT;

const ROW_COUNT_VALUES = [
  ROW_COUNT_VALUE_DEFAULT,
  500,
  ROW_COUNT_VALUE_SYNC_LIMIT,
  10_000,
  50_000,
  100_000,
];

const exportModalFormSchema = z.object({
  format: z.enum(['csv', 'jsonl']),
  limit: z.number(),
});

type ExportModalFormValues = z.infer<typeof exportModalFormSchema>;

type LogsExportModalProps = ModalRenderProps & {
  queryInfo: LogsQueryInfo;
  tableData: OurLogsResponseItem[];
};

function generateRowOptions(estimatedRowCount: number) {
  const rowOptions: Array<SelectValue<number>> = ROW_COUNT_VALUES.map(value => ({
    label: formatNumber(value),
    value,
  })).filter(({value}) => value <= estimatedRowCount);

  if (
    !rowOptions.length ||
    (estimatedRowCount > rowOptions[rowOptions.length - 1]!.value &&
      rowOptions.length < ROW_COUNT_VALUES.length)
  ) {
    rowOptions.push({
      label: t('%s (All)', formatNumber(estimatedRowCount)),
      value: estimatedRowCount,
    });
  }

  return rowOptions;
}

export function LogsExportModal({
  Body,
  Footer,
  Header,
  closeModal,
  queryInfo,
  tableData,
}: LogsExportModalProps) {
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
  const rowOptions = generateRowOptions(estimatedRowCount);
  const defaultValues: ExportModalFormValues = {
    format: 'csv',
    limit: rowOptions[0]!.value,
  };

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues,
    validators: {
      onDynamic: exportModalFormSchema,
    },
    onSubmit: async ({value}) => {
      if (value.limit > ROW_COUNT_VALUE_SYNC_LIMIT) {
        await handleDataExport({
          format: value.format,
          queryInfo: {
            ...payload.queryInfo,
            limit: value.limit,
          },
          queryType: payload.queryType,
        });
      } else {
        downloadLogs({
          rows: tableData.slice(0, value.limit),
          fields: queryInfo.field,
          filename: 'logs',
          format: value.format,
        });
        addSuccessMessage(t('Downloading file to your browser.'));
      }

      closeModal();
    },
  });

  return (
    <form.AppForm form={form}>
      <Header closeButton>
        <Heading as="h2">{t('Logs Export')}</Heading>
      </Header>
      <Body>
        <Stack gap="xl">
          <Text>
            {t(
              'If you select more than %s rows your file will be sent to your email address.',
              formatNumber(ROW_COUNT_VALUE_SYNC_LIMIT)
            )}
          </Text>
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
          <form.AppField name="limit">
            {field => (
              <field.Layout.Stack label={t('Number of rows')}>
                <field.Select
                  disabled={rowOptions.length === 1}
                  options={rowOptions}
                  onChange={field.handleChange}
                  value={field.state.value}
                  defaultValue={rowOptions[0]}
                />
              </field.Layout.Stack>
            )}
          </form.AppField>
        </Stack>
      </Body>
      <Footer>
        <Flex gap="xl" justify="end">
          <Button priority="default" onClick={closeModal}>
            {t('Cancel')}
          </Button>
          <form.SubmitButton priority="primary">{t('Export')}</form.SubmitButton>
        </Flex>
      </Footer>
    </form.AppForm>
  );
}
