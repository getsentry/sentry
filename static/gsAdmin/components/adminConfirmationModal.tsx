import {Fragment, isValidElement, useCallback, useEffect, useState} from 'react';
import {z} from 'zod';

import type {ConfirmMessageRenderProps, OpenConfirmOptions} from '@sentry/scraps/confirm';
import {Confirm, openConfirmModal} from '@sentry/scraps/confirm';
import {defaultFormOptions, useScrapsForm, useStore} from '@sentry/scraps/form';
import {Container, Stack} from '@sentry/scraps/layout';

type ConfirmProps = React.ComponentProps<typeof Confirm>;

export type AdminConfirmParams = {
  /**
   * Additional properties may be set via the renderModalSpecificContent
   */
  [key: string]: any;
  notes?: string;
  ticketURL?: string;
};

type AdminConfirmCallback = (params: AdminConfirmParams) => void;

export type AdminConfirmRenderProps = Omit<
  ConfirmMessageRenderProps,
  'setConfirmCallback'
> & {
  onConfirm: Props['onConfirm'];
  setConfirmCallback: (cb: AdminConfirmCallback) => void;
};

type Props = Omit<ConfirmProps, 'onConfirm'> & {
  modalSpecificContent?: React.ReactNode;
  onConfirm?: (params: AdminConfirmParams) => void;
  renderModalSpecificContent?: (props: AdminConfirmRenderProps) => React.ReactNode;
  showAuditFields?: boolean;
  showTicketURL?: boolean;
};

const ticketURLSchema = z
  .string()
  .refine(value => value === '' || z.url().safeParse(value).success, {
    message: 'Invalid ticket URL',
  });

const auditSchema = z.object({ticketURL: ticketURLSchema, notes: z.string()});

const noAuditParams: AdminConfirmParams = {};

/**
 * Form options for an action body rendered inside the modal. The confirm
 * button stays disabled while the values fail `schema`, and the action
 * registers `params => form.handleSubmit(params)` as its confirm callback so
 * `onSubmit` receives the audit params as `meta`.
 */
export function adminConfirmFormOptions(
  schema: z.ZodType,
  disableConfirmButton: (disable: boolean) => void
) {
  const sync = ({formApi}: {formApi: {state: {values: unknown}}}) =>
    disableConfirmButton(!schema.safeParse(formApi.state.values).success);

  return {listeners: {onMount: sync, onChange: sync}, onSubmitMeta: noAuditParams};
}

/**
 * A variant of the Confirm component that also includes audit trail
 * information, including a `ticketURL` and `notes`
 */
export function AdminConfirmationModal({
  children,
  onConfirm,
  renderModalSpecificContent,
  modalSpecificContent,
  showAuditFields = true,
  showTicketURL = true,
  ...props
}: Props) {
  return (
    <Confirm
      {...props}
      renderMessage={renderProps => (
        <AdminConfirmMessage
          {...{
            onConfirm,
            renderModalSpecificContent,
            modalSpecificContent,
            showAuditFields,
            showTicketURL,
          }}
          initiallyDisabled={props.disableConfirmButton ?? false}
          {...renderProps}
        />
      )}
    >
      {children}
    </Confirm>
  );
}

type OpenAdminConfirmOptions = Omit<OpenConfirmOptions, 'onConfirm'> & {
  modalSpecificContent?: React.ReactNode;
  onConfirm?: (params: AdminConfirmParams) => void;
  renderModalSpecificContent?: (props: AdminConfirmRenderProps) => React.ReactNode;
  showAuditFields?: boolean;
  showTicketURL?: boolean;
};

export const openAdminConfirmModal = ({
  onConfirm,
  renderModalSpecificContent,
  modalSpecificContent,
  showAuditFields = true,
  showTicketURL = true,
  ...opts
}: OpenAdminConfirmOptions) =>
  openConfirmModal({
    renderMessage: renderProps => (
      <AdminConfirmMessage
        {...{
          onConfirm,
          renderModalSpecificContent,
          modalSpecificContent,
          showAuditFields,
          showTicketURL,
        }}
        initiallyDisabled={opts.disableConfirmButton ?? false}
        {...renderProps}
      />
    ),
    ...opts,
  });

type ConfirmMessageProps = ConfirmMessageRenderProps &
  Pick<
    Props,
    | 'renderModalSpecificContent'
    | 'modalSpecificContent'
    | 'showAuditFields'
    | 'showTicketURL'
    | 'onConfirm'
  > & {initiallyDisabled: boolean};

function AdminConfirmMessage({
  renderModalSpecificContent,
  modalSpecificContent,
  showAuditFields,
  showTicketURL,
  confirm,
  close,
  disableConfirmButton,
  setConfirmCallback,
  onConfirm,
  initiallyDisabled,
}: ConfirmMessageProps) {
  // Registered by the action body. It receives the audit params and decides
  // whether to call onConfirm.
  const [actionConfirm, setActionConfirm] = useState<AdminConfirmCallback | null>(null);
  const [actionDisabled, setActionDisabled] = useState(initiallyDisabled);

  const registerActionConfirm = useCallback(
    (cb: AdminConfirmCallback) => setActionConfirm(() => cb),
    []
  );

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {ticketURL: '', notes: ''},
    validators: {onDynamic: auditSchema},
    onSubmit: ({value}) => {
      const params = {
        ...(value.notes && {notes: value.notes}),
        ...(value.ticketURL && {ticketURL: value.ticketURL}),
      };

      if (actionConfirm === null) {
        onConfirm?.(params);
      } else {
        actionConfirm(params);
      }
    },
  });

  const auditInvalid = useStore(form.store, state => !state.isValid);

  useEffect(() => {
    disableConfirmButton(auditInvalid || actionDisabled);
  }, [disableConfirmButton, auditInvalid, actionDisabled]);

  useEffect(() => {
    setConfirmCallback(() => form.handleSubmit());
  }, [setConfirmCallback, form]);

  const bodyTopHalf =
    renderModalSpecificContent === undefined ? (
      isValidElement(modalSpecificContent) ? (
        modalSpecificContent
      ) : (
        <p>
          <strong>{modalSpecificContent}</strong>
        </p>
      )
    ) : (
      renderModalSpecificContent({
        confirm,
        close,
        disableConfirmButton: setActionDisabled,
        setConfirmCallback: registerActionConfirm,
        onConfirm,
      })
    );

  return (
    <Fragment>
      {bodyTopHalf}

      {showAuditFields && (
        <Container marginTop="xl">
          <form.AppForm form={form}>
            <Stack gap="lg">
              {showTicketURL && (
                <form.AppField name="ticketURL" validators={{onBlur: ticketURLSchema}}>
                  {field => (
                    <field.Layout.Stack label="TicketURL">
                      <field.Input
                        type="url"
                        value={field.state.value}
                        onChange={field.handleChange}
                      />
                    </field.Layout.Stack>
                  )}
                </form.AppField>
              )}
              <form.AppField name="notes">
                {field => (
                  <field.Layout.Stack label="Notes">
                    <field.TextArea
                      autosize
                      value={field.state.value}
                      onChange={field.handleChange}
                    />
                  </field.Layout.Stack>
                )}
              </form.AppField>
            </Stack>
          </form.AppForm>
        </Container>
      )}
    </Fragment>
  );
}
