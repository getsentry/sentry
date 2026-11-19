import {z} from 'zod';

import {Button} from '@sentry/scraps/button';
import {defaultFormOptions, useScrapsForm, useStore} from '@sentry/scraps/form';
import {Flex, Stack} from '@sentry/scraps/layout';
import type {ModalRenderProps} from '@sentry/scraps/modal';
import {Heading, Text} from '@sentry/scraps/text';
import {toast} from '@sentry/scraps/toast';

import {generateExportRowCountOptions} from 'sentry/components/exports/generateExportRowCountOptions';
import {
  type DataExportPayload,
  ExportQueryType,
  useDataExport,
} from 'sentry/components/exports/useDataExport';
import {t} from 'sentry/locale';

import type {ExploreExportConfig} from './types';

enum ModalColumnValue {
  ALL = 'all',
  SELECTED = 'selected',
}

const exportModalFormSchema = z.object({
  columns: z.enum(ModalColumnValue),
  format: z.enum(['csv', 'jsonl']),
  limit: z.number(),
});

type ExportModalFormValues = z.infer<typeof exportModalFormSchema>;

type ExploreExportModalProps = ModalRenderProps & {
  config: ExploreExportConfig;
  /** Called when the in-modal Cancel button is clicked (for analytics). */
  onCancel?: () => void;
};

export function ExploreExportModal({
  Body,
  Footer,
  Header,
  closeModal,
  config,
  onCancel,
}: ExploreExportModalProps) {
  const {
    availableFormats,
    estimatedRowCount,
    localDownload,
    localRowCount,
    supportsAllColumns,
    title,
    trackExportSubmit,
  } = config;

  const {mutateAsync: handleDataExport} = useDataExport();
  const {rowCountDefault, rowCountOptions} =
    generateExportRowCountOptions(estimatedRowCount);

  const showFormatRadio = availableFormats.length > 1;

  const defaultValues: ExportModalFormValues = {
    columns: ModalColumnValue.SELECTED,
    format: availableFormats[0] ?? 'csv',
    limit: rowCountDefault.value,
  };

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues,
    validators: {
      onDynamic: exportModalFormSchema,
    },
    onSubmit: async ({value}) => {
      const isAllColumns =
        config.supportsAllColumns && value.columns === ModalColumnValue.ALL;

      const format = isAllColumns ? 'jsonl' : value.format;

      // Areas cap what their browser download can serve with `localRowCount`, so
      // anything beyond that must go through the server export.
      const localDownloadForSubmit =
        !isAllColumns && localDownload && value.limit <= (localRowCount ?? 0)
          ? localDownload
          : undefined;
      const exportType = localDownloadForSubmit ? 'browser_sync' : 'export_download';

      trackExportSubmit({format, limit: value.limit, isAllColumns, exportType});

      if (localDownloadForSubmit) {
        localDownloadForSubmit({format, limit: value.limit});
        toast.success(t('Downloading file to your browser.'));
        closeModal();
        return;
      }

      const payload: DataExportPayload =
        config.asyncQueryType === ExportQueryType.DISCOVER
          ? {
              format,
              limit: value.limit,
              queryType: ExportQueryType.DISCOVER,
              queryInfo: config.queryInfo,
            }
          : isAllColumns
            ? {
                format,
                limit: value.limit,
                queryType: ExportQueryType.TRACE_ITEM_FULL_EXPORT,
                queryInfo: {...config.queryInfo, field: []},
              }
            : {
                format,
                limit: value.limit,
                queryType: ExportQueryType.EXPLORE,
                queryInfo: config.queryInfo,
              };

      try {
        await handleDataExport(payload);
        closeModal();
      } catch {
        // The error message is surfaced by useDataExport's onError handler.
      }
    },
  });

  const columnsValue = useStore(form.store, state => state.values.columns);

  return (
    <form.AppForm form={form}>
      <Header closeButton>
        <Heading as="h2">{title}</Heading>
      </Header>
      <Body>
        <Stack gap="xl">
          <Text>
            {t(
              'When a high number of rows is selected and events are large, the results may be sent to your email.'
            )}
          </Text>
          {showFormatRadio && (
            <form.AppField name="format">
              {field => (
                <field.RadioGroup
                  value={
                    columnsValue === ModalColumnValue.ALL ? 'jsonl' : field.state.value
                  }
                  onChange={field.handleChange}
                  disabled={columnsValue === ModalColumnValue.ALL}
                >
                  {({Item}) => (
                    <field.Layout.Stack label={t('Format')} align="start">
                      <Item value="csv">{t('CSV')}</Item>
                      <Item value="jsonl">{t('JSONL')}</Item>
                    </field.Layout.Stack>
                  )}
                </field.RadioGroup>
              )}
            </form.AppField>
          )}
          {supportsAllColumns && (
            <form.AppField name="columns">
              {field => (
                <field.Layout.Stack
                  hintText={t('All columns are only supported by JSONL.')}
                  label={t('All Columns?')}
                >
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
          )}
          <form.AppField name="limit">
            {field => (
              <field.Layout.Stack label={t('Number of rows')} align="start">
                <field.CompactSelect
                  disabled={rowCountOptions.length === 1}
                  options={rowCountOptions}
                  value={field.state.value}
                  onChange={field.handleChange}
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
              onCancel?.();
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
