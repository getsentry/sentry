import {z} from 'zod';

import {Button} from '@sentry/scraps/button';
import {CompactSelect} from '@sentry/scraps/compactSelect';
import {defaultFormOptions, useScrapsForm, useStore} from '@sentry/scraps/form';
import {Flex, Stack} from '@sentry/scraps/layout';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';
import {Heading, Text} from '@sentry/scraps/text';

import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {generateExportRowCountOptions} from 'sentry/components/exports/generateExportRowCountOptions';
import {
  type DataExportPayload,
  ExportQueryType,
  useDataExport,
} from 'sentry/components/exports/useDataExport';
import {t} from 'sentry/locale';
import type {ExploreExportConfig} from 'sentry/views/explore/components/exports/types';

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
    queryInfo,
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
    format: availableFormats[0] as ModalColumnFormat,
    limit: rowCountDefault.value,
  };

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues,
    validators: {
      onDynamic: exportModalFormSchema,
    },
    onSubmit: async ({value}) => {
      const isAllColumns = supportsAllColumns && value.columns === ModalColumnValue.ALL;
      // The local download can only serve rows already loaded in the browser, so
      // anything beyond that must go through the server export.
      const exceedsLocalData = value.limit > localRowCount;

      const format = isAllColumns ? 'jsonl' : value.format;

      const useServerExport = isAllColumns || exceedsLocalData;
      const exportType = useServerExport ? 'export_download' : 'browser_sync';

      trackExportSubmit({format, limit: value.limit, isAllColumns, exportType});

      if (useServerExport) {
        try {
          // The shared modal is generic across query types, so the payload is
          // assembled dynamically rather than matching a single union member.
          await handleDataExport({
            format,
            queryInfo: isAllColumns ? {...queryInfo, field: []} : queryInfo,
            queryType: isAllColumns
              ? ExportQueryType.TRACE_ITEM_FULL_EXPORT
              : config.asyncQueryType,
            limit: value.limit,
          } as DataExportPayload);
        } catch {
          // The error message is surfaced by useDataExport's onError handler.
        }
      } else {
        localDownload({format, limit: value.limit});
        addSuccessMessage(t('Downloading file to your browser.'));
        closeModal();
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
