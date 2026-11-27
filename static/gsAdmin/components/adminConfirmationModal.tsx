import {cloneElement, isValidElement, useCallback, useState} from 'react';
import {z} from 'zod';

import type {ButtonProps} from '@sentry/scraps/button';
import {Button} from '@sentry/scraps/button';
import {defaultFormOptions, useScrapsForm, withFieldGroup} from '@sentry/scraps/form';
import {Flex, Stack} from '@sentry/scraps/layout';
import type {ModalRenderProps} from '@sentry/scraps/modal';
import {openModal} from '@sentry/scraps/modal';
import {Text} from '@sentry/scraps/text';

export type AdminConfirmParams = {
  /**
   * Additional properties may be set via the renderModalSpecificContent
   */
  [key: string]: any;
  notes?: string;
  ticketURL?: string;
};

export const adminAuditSchema = z.object({
  ticketURL: z
    .string()
    .refine(value => value === '' || z.url().safeParse(value).success, {
      message: 'Invalid ticket URL',
    }),
  notes: z.string(),
});

export const adminAuditDefaults: z.input<typeof adminAuditSchema> = {
  ticketURL: '',
  notes: '',
};

/**
 * Drops empty audit fields so they are not sent with the action.
 */
export function adminAuditParams({
  ticketURL,
  notes,
}: z.output<typeof adminAuditSchema>): AdminConfirmParams {
  return {...(notes && {notes}), ...(ticketURL && {ticketURL})};
}

/**
 * The ticket URL and notes fields. Add an `audit` field to the form values
 * with `adminAuditDefaults` and `adminAuditSchema`, then render
 * `<AdminAuditFields form={form} fields="audit" />`.
 */
const adminAuditFieldsProps: {showTicketURL?: boolean} = {};

export const AdminAuditFields = withFieldGroup({
  defaultValues: adminAuditDefaults,
  props: adminAuditFieldsProps,
  render: function AdminAuditFieldsRender({group, showTicketURL = true}) {
    return (
      <Stack gap="lg">
        {showTicketURL && (
          <group.AppField name="ticketURL">
            {field => (
              <field.Layout.Stack label="TicketURL">
                <field.Input
                  type="url"
                  value={field.state.value}
                  onChange={field.handleChange}
                />
              </field.Layout.Stack>
            )}
          </group.AppField>
        )}
        <group.AppField name="notes">
          {field => (
            <field.Layout.Stack label="Notes">
              <field.TextArea
                autosize
                value={field.state.value}
                onChange={field.handleChange}
              />
            </field.Layout.Stack>
          )}
        </group.AppField>
      </Stack>
    );
  },
});

/**
 * Props for an admin action modal that owns its form. The modal calls
 * `onConfirm` with its params and the audit params, then closes.
 */
export type AdminActionModalProps = ModalRenderProps & {
  onConfirm: (params: AdminConfirmParams) => void;
  header?: React.ReactNode;
};

type AdminConfirmCallback = (params: AdminConfirmParams) => void;

export type AdminConfirmRenderProps = {
  disableConfirmButton: (disabled: boolean) => void;
  onConfirm: AdminConfirmOptions['onConfirm'];
  /**
   * Registers a callback that receives the audit params on confirm and
   * decides whether to call onConfirm.
   */
  setConfirmCallback: (cb: AdminConfirmCallback) => void;
};

type AdminConfirmOptions = {
  confirmText?: React.ReactNode;
  disableConfirmButton?: boolean;
  header?: React.ReactNode;
  modalSpecificContent?: React.ReactNode;
  onCancel?: () => void;
  onConfirm?: (params: AdminConfirmParams) => void;
  priority?: ButtonProps['variant'];
  renderModalSpecificContent?: (props: AdminConfirmRenderProps) => React.ReactNode;
  showAuditFields?: boolean;
  showTicketURL?: boolean;
};

const auditFormSchema = z.object({audit: adminAuditSchema});

function AdminConfirmModal({
  Header,
  Body,
  Footer,
  closeModal,
  confirmText = 'Confirm',
  disableConfirmButton = false,
  header,
  modalSpecificContent,
  onCancel,
  onConfirm,
  priority = 'primary',
  renderModalSpecificContent,
  showAuditFields = true,
  showTicketURL = true,
}: ModalRenderProps & AdminConfirmOptions) {
  const [confirmDisabled, setConfirmDisabled] = useState(disableConfirmButton);
  // Registered by content that decides whether to call onConfirm.
  const [actionConfirm, setActionConfirm] = useState<AdminConfirmCallback | null>(null);
  const registerActionConfirm = useCallback(
    (cb: AdminConfirmCallback) => setActionConfirm(() => cb),
    []
  );

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {audit: adminAuditDefaults},
    validators: {onDynamic: auditFormSchema},
    onSubmit: ({value}) => {
      const params = adminAuditParams(value.audit);
      if (actionConfirm === null) {
        onConfirm?.(params);
      } else {
        actionConfirm(params);
      }
      closeModal();
    },
  });

  return (
    <form.AppForm form={form}>
      {header && <Header>{header}</Header>}
      <Body>
        <Stack gap="xl">
          {renderModalSpecificContent === undefined ? (
            isValidElement(modalSpecificContent) ? (
              modalSpecificContent
            ) : (
              <Text as="p" bold>
                {modalSpecificContent}
              </Text>
            )
          ) : (
            renderModalSpecificContent({
              disableConfirmButton: setConfirmDisabled,
              onConfirm,
              setConfirmCallback: registerActionConfirm,
            })
          )}
          {showAuditFields && (
            <AdminAuditFields form={form} fields="audit" showTicketURL={showTicketURL} />
          )}
        </Stack>
      </Body>
      <Footer>
        <Flex align="center" gap="xl">
          <Button
            onClick={() => {
              onCancel?.();
              closeModal();
            }}
          >
            Cancel
          </Button>
          <form.SubmitButton variant={priority} disabled={confirmDisabled}>
            {confirmText}
          </form.SubmitButton>
        </Flex>
      </Footer>
    </form.AppForm>
  );
}

/**
 * Opens a confirmation modal that also collects audit trail information: a
 * `ticketURL` and `notes`.
 */
export function openAdminConfirmModal(options: AdminConfirmOptions) {
  openModal(deps => <AdminConfirmModal {...deps} {...options} />);
}

/**
 * Wraps a trigger element that opens `openAdminConfirmModal` when clicked.
 */
export function AdminConfirmationModal({
  children,
  ...options
}: AdminConfirmOptions & {
  children: React.ReactElement<{onClick?: (e: React.MouseEvent) => void}>;
}) {
  return cloneElement(children, {onClick: () => openAdminConfirmModal(options)});
}
