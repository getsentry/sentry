import {Component, Fragment, isValidElement} from 'react';
import styled from '@emotion/styled';

import type {
  ConfirmMessageRenderProps,
  OpenConfirmOptions,
} from 'sentry/components/confirm';
import Confirm, {openConfirmModal} from 'sentry/components/confirm';
import InputField from 'sentry/components/forms/fields/inputField';
import TextareaField from 'sentry/components/forms/fields/textareaField';
import {space} from 'sentry/styles/space';

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
};

/**
 * A variant of the Confirm component that also includes audit trail
 * information, including a `ticketURL` and `notes`
 */
function AdminConfirmationModal({
  children,
  onConfirm,
  renderModalSpecificContent,
  modalSpecificContent,
  showAuditFields = true,
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
};

export const openAdminConfirmModal = ({
  onConfirm,
  renderModalSpecificContent,
  modalSpecificContent,
  showAuditFields = true,
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
    | 'onConfirm'
  >;

type State = {
  confirmCallback: ((params: AdminConfirmParams) => void) | null;
  invalidTicketURL: boolean;
  notes: string | null;
  ticketURL: string | null;
};

class AdminConfirmMessage extends Component<ConfirmMessageProps, State> {
  state: State = {
    notes: null,
    ticketURL: null,
    invalidTicketURL: false,
    confirmCallback: null,
  };

  componentDidMount() {
    this.props.setConfirmCallback?.(this.handleConfirm);
  }

  handleConfirm = () => {
    const {onConfirm} = this.props;
    const {notes, ticketURL, confirmCallback} = this.state;

    const params = {...(notes && {notes}), ...(ticketURL && {ticketURL})};

    // If a new confirm callback has been registered chain to that. The
    // downstream callback may choose to trigger onConfirm.
    if (confirmCallback === null) {
      onConfirm?.(params);
    } else {
      confirmCallback(params);
    }
  };

  render() {
    const {
      renderModalSpecificContent,
      modalSpecificContent,
      showAuditFields,
      confirm,
      close,
      disableConfirmButton,
      onConfirm,
    } = this.props;

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
          setConfirmCallback: confirmCallback => this.setState({confirmCallback}),
          onConfirm,
        })
      );

    return (
      <Fragment>
        {bodyTopHalf}

        {showAuditFields && (
          <AuditFields>
            <InputField
              data-test-id="url-field"
              name="ticket-url"
              type="url"
              label="TicketURL"
              inline={false}
              stacked
              flexibleControlStateSize
              onChange={(ticketURL: any) => this.setState({ticketURL})}
              error={this.state.invalidTicketURL ? 'Invalid ticket URL' : undefined}
              onBlur={(_: any, e: any) => {
                const invalidTicketURL =
                  !e.target.checkValidity() && e.target.value !== '';
                this.setState({invalidTicketURL});
                disableConfirmButton(invalidTicketURL);
              }}
            />
            <TextareaField
              data-test-id="notes-field"
              name="notes"
              label="Notes"
              inline={false}
              stacked
              autosize
              flexibleControlStateSize
              onChange={(notes: any) => this.setState({notes})}
            />
          </AuditFields>
        )}
      </Fragment>
    );
  }
}

const AuditFields = styled('div')`
  margin-top: ${space(2)};
`;

export default AdminConfirmationModal;
