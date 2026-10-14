import {Fragment, isValidElement, useCallback, useEffect, useRef, useState} from 'react';

import {Container} from '@sentry/scraps/layout';

import type {
  ConfirmMessageRenderProps,
  OpenConfirmOptions,
} from 'sentry/components/confirm';
import {Confirm, openConfirmModal} from 'sentry/components/confirm';
import {InputField} from 'sentry/components/forms/fields/inputField';
import {TextareaField} from 'sentry/components/forms/fields/textareaField';

type ConfirmProps = React.ComponentProps<typeof Confirm>;

export type AdminConfirmParams = {
  /**
   * Additional properties may be set via the renderModalSpecificContent
   */
  [key: string]: any;
  notes?: string;
  ticketURL?: string;
};

export type AdminConfirmRenderProps = Omit<
  ConfirmMessageRenderProps,
  'setConfirmCallback'
> & {
  onConfirm: Props['onConfirm'];
  setConfirmCallback: (cb: (params: AdminConfirmParams) => void) => void;
};

type Props = Omit<ConfirmProps, 'onConfirm'> & {
  modalSpecificContent?: React.ReactNode;
  onConfirm?: (params: AdminConfirmParams) => void;
  renderModalSpecificContent?: (props: AdminConfirmRenderProps) => React.ReactNode;
  showAuditFields?: boolean;
  showTicketURL?: boolean;
};

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
  >;

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
}: ConfirmMessageProps) {
  const [invalidTicketURL, setInvalidTicketURL] = useState(false);

  // These values are only read when the user confirms, so they are kept in
  // refs to ensure the registered confirm handler always sees the latest
  // values without needing to re-render.
  const notesRef = useRef<string | null>(null);
  const ticketURLRef = useRef<string | null>(null);
  const confirmCallbackRef = useRef<((params: AdminConfirmParams) => void) | null>(null);

  const handleConfirm = useCallback(() => {
    const notes = notesRef.current;
    const ticketURL = ticketURLRef.current;
    const confirmCallback = confirmCallbackRef.current;

    const params = {...(notes && {notes}), ...(ticketURL && {ticketURL})};

    // If a new confirm callback has been registered chain to that. The
    // downstream callback may choose to trigger onConfirm.
    if (confirmCallback === null) {
      onConfirm?.(params);
    } else {
      confirmCallback(params);
    }
  }, [onConfirm]);

  useEffect(() => {
    setConfirmCallback?.(handleConfirm);
  }, [setConfirmCallback, handleConfirm]);

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
        disableConfirmButton,
        // XXX(epurkhiser): This can bit a bit confusing. Since this component
        // is already augmenting the Confirm component, we're actually
        // accepting a different confirmCallback, which accepts the audit
        // parameters.
        setConfirmCallback: confirmCallback => {
          confirmCallbackRef.current = confirmCallback;
        },
        onConfirm,
      })
    );

  return (
    <Fragment>
      {bodyTopHalf}

      {showAuditFields && (
        <Container marginTop="xl">
          {showTicketURL && (
            <InputField
              data-test-id="url-field"
              name="ticket-url"
              type="url"
              label="TicketURL"
              inline={false}
              stacked
              flexibleControlStateSize
              onChange={(ticketURL: any) => {
                ticketURLRef.current = ticketURL;
              }}
              error={invalidTicketURL ? 'Invalid ticket URL' : undefined}
              onBlur={(_: any, e: any) => {
                const isInvalid = !e.target.checkValidity() && e.target.value !== '';
                setInvalidTicketURL(isInvalid);
                disableConfirmButton(isInvalid);
              }}
            />
          )}
          <TextareaField
            data-test-id="notes-field"
            name="notes"
            label="Notes"
            inline={false}
            stacked
            autosize
            flexibleControlStateSize
            onChange={(notes: any) => {
              notesRef.current = notes;
            }}
          />
        </Container>
      )}
    </Fragment>
  );
}
