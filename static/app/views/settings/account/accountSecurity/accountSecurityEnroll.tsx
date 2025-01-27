import {Fragment} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import {QRCodeCanvas} from 'qrcode.react';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import {openRecoveryOptions} from 'sentry/actionCreators/modal';
import {
  fetchOrganizationByMember,
  fetchOrganizations,
} from 'sentry/actionCreators/organizations';
import {Alert} from 'sentry/components/alert';
import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import CircleIndicator from 'sentry/components/circleIndicator';
import DeprecatedAsyncComponent from 'sentry/components/deprecatedAsyncComponent';
import FieldGroup from 'sentry/components/forms/fieldGroup';
import type {FormProps} from 'sentry/components/forms/form';
import Form from 'sentry/components/forms/form';
import JsonForm from 'sentry/components/forms/jsonForm';
import FormModel from 'sentry/components/forms/model';
import type {FieldObject} from 'sentry/components/forms/types';
import PanelItem from 'sentry/components/panels/panelItem';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import TextCopyInput from 'sentry/components/textCopyInput';
import U2fSign from 'sentry/components/u2f/u2fsign';
import {t} from 'sentry/locale';
import OrganizationsStore from 'sentry/stores/organizationsStore';
import {space} from 'sentry/styles/space';
import type {Authenticator} from 'sentry/types/auth';
import type {WithRouterProps} from 'sentry/types/legacyReactRouter';
import {generateOrgSlugUrl} from 'sentry/utils';
import getPendingInvite from 'sentry/utils/getPendingInvite';
// eslint-disable-next-line no-restricted-imports
import withSentryRouter from 'sentry/utils/withSentryRouter';
import RemoveConfirm from 'sentry/views/settings/account/accountSecurity/components/removeConfirm';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import TextBlock from 'sentry/views/settings/components/text/textBlock';

type GetFieldsOpts = {
  authenticator: Authenticator;
  /**
   * Flag to track if totp has been sent
   */
  hasSentCode: boolean;
  /**
   * Callback to reset SMS 2fa enrollment
   */
  onSmsReset: () => void;
  /**
   * Callback when u2f device is activated
   */
  onU2fTap: React.ComponentProps<typeof U2fSign>['onTap'];
  /**
   * Flag to track if we are currently sending the otp code
   */
  sendingCode: boolean;
};

/**
 * Retrieve additional form fields (or modify ones) based on 2fa method
 */
const getFields = ({
  authenticator,
  hasSentCode,
  sendingCode,
  onSmsReset,
  onU2fTap,
}: GetFieldsOpts): null | FieldObject[] => {
  const {form} = authenticator;

  if (!form) {
    return null;
  }

  if (authenticator.id === 'totp') {
    return [
      () => (
        <CodeContainer key="qrcode">
          <StyledQRCode
            aria-label={t('Enrollment QR Code')}
            value={authenticator.qrcode}
            size={228}
          />
        </CodeContainer>
      ),
      () => (
        <FieldGroup key="secret" label={t('Authenticator secret')}>
          <TextCopyInput>{authenticator.secret ?? ''}</TextCopyInput>
        </FieldGroup>
      ),
      ...form,
      () => (
        <Actions key="confirm">
          <Button priority="primary" type="submit">
            {t('Confirm')}
          </Button>
        </Actions>
      ),
    ];
  }

  // Sms Form needs a start over button + confirm button
  // Also inputs being disabled vary based on hasSentCode
  if (authenticator.id === 'sms') {
    // Ideally we would have greater flexibility when rendering footer
    return [
      {...form[0]!, disabled: sendingCode || hasSentCode},
      ...(hasSentCode ? [{...form[1]!, required: true}] : []),
      () => (
        <Actions key="sms-footer">
          <ButtonBar gap={1}>
            {hasSentCode && <Button onClick={onSmsReset}>{t('Start Over')}</Button>}
            <Button priority="primary" type="submit">
              {hasSentCode ? t('Confirm') : t('Send Code')}
            </Button>
          </ButtonBar>
        </Actions>
      ),
    ];
  }

  // Need to render device name field + U2f component
  if (authenticator.id === 'u2f') {
    const deviceNameField = form.find(({name}) => name === 'deviceName')!;
    return [
      deviceNameField,
      () => (
        <U2fSign
          key="u2f-enroll"
          style={{marginBottom: 0}}
          challengeData={authenticator.challenge}
          displayMode="enroll"
          onTap={onU2fTap}
        />
      ),
    ];
  }

  return null;
};

type Props = DeprecatedAsyncComponent['props'] &
  WithRouterProps<{authId: string}, {}> & {};

type State = DeprecatedAsyncComponent['state'] & {
  authenticator: Authenticator | null;
  hasSentCode: boolean;
  sendingCode: boolean;
};

type PendingInvite = ReturnType<typeof getPendingInvite>;

/**
 * Renders necessary forms in order to enroll user in 2fa
 */
class AccountSecurityEnroll extends DeprecatedAsyncComponent<Props, State> {
  formModel = new FormModel();

  getDefaultState() {
    return {...super.getDefaultState(), hasSentCode: false};
  }

  get authenticatorEndpoint() {
    return `/users/me/authenticators/${this.props.params.authId}/`;
  }

  get enrollEndpoint() {
    return `${this.authenticatorEndpoint}enroll/`;
  }

  getEndpoints(): ReturnType<DeprecatedAsyncComponent['getEndpoints']> {
    const errorHandler = (err: any) => {
      const alreadyEnrolled =
        err &&
        err.status === 400 &&
        err.responseJSON &&
        err.responseJSON.details === 'Already enrolled';

      if (alreadyEnrolled) {
        this.props.router.push('/settings/account/security/');
        addErrorMessage(t('Already enrolled'));
      }

      // Allow the endpoint to fail if the user is already enrolled
      return alreadyEnrolled;
    };

    return [['authenticator', this.enrollEndpoint, {}, {allowError: errorHandler}]];
  }

  componentDidMount() {
    super.componentDidMount();
    this.pendingInvitation = getPendingInvite();
  }

  pendingInvitation: PendingInvite = null;

  get authenticatorName() {
    return this.state.authenticator?.name ?? 'Authenticator';
  }

  // This resets state so that user can re-enter their phone number again
  handleSmsReset = () => this.setState({hasSentCode: false}, this.remountComponent);

  // Handles SMS authenticators
  handleSmsSubmit = async (dataModel: any) => {
    const {authenticator, hasSentCode} = this.state;
    const {phone, otp} = dataModel;

    // Don't submit if empty
    if (!phone || !authenticator) {
      return;
    }

    const data = {
      phone,
      // Make sure `otp` is undefined if we are submitting OTP verification
      // Otherwise API will think that we are on verification step (e.g. after submitting phone)
      otp: hasSentCode ? otp : undefined,
      secret: authenticator.secret,
    };

    // Only show loading when submitting OTP
    this.setState({sendingCode: !hasSentCode});

    if (!hasSentCode) {
      addLoadingMessage(t('Sending code to %s...', data.phone));
    } else {
      addLoadingMessage(t('Verifying OTP...'));
    }

    try {
      await this.api.requestPromise(this.enrollEndpoint, {data});
    } catch (error) {
      this.formModel.resetForm();

      addErrorMessage(
        this.state.hasSentCode ? t('Incorrect OTP') : t('Error sending SMS')
      );

      this.setState({
        hasSentCode: false,
        sendingCode: false,
      });

      // Re-mount because we want to fetch a fresh secret
      this.remountComponent();

      return;
    }

    if (!hasSentCode) {
      // Just successfully finished sending OTP to user
      this.setState({hasSentCode: true, sendingCode: false});
      addSuccessMessage(t('Sent code to %s', data.phone));
    } else {
      // OTP was accepted and SMS was added as a 2fa method
      this.handleEnrollSuccess();
    }
  };

  // Handle u2f device tap
  handleU2fTap = async (tapData: any) => {
    const data = {deviceName: this.formModel.getValue('deviceName'), ...tapData};

    this.setState({loading: true});

    try {
      await this.api.requestPromise(this.enrollEndpoint, {data});
    } catch (err) {
      this.handleEnrollError();
      return;
    }

    this.handleEnrollSuccess();
  };

  // Currently only TOTP uses this
  handleTotpSubmit = async (dataModel: any) => {
    if (!this.state.authenticator) {
      return;
    }

    const data = {
      ...(dataModel ?? {}),
      secret: this.state.authenticator.secret,
    };

    this.setState({loading: true});

    try {
      await this.api.requestPromise(this.enrollEndpoint, {method: 'POST', data});
    } catch (err) {
      this.handleEnrollError();
      return;
    }

    this.handleEnrollSuccess();
  };

  handleSubmit: FormProps['onSubmit'] = data => {
    const id = this.state.authenticator?.id;

    if (id === 'totp') {
      this.handleTotpSubmit(data);
      return;
    }
    if (id === 'sms') {
      this.handleSmsSubmit(data);
      return;
    }
  };

  // Handler when we successfully add a 2fa device
  async handleEnrollSuccess() {
    // If we're pending approval of an invite, the user will have just joined
    // the organization when completing 2fa enrollment. We should reload the
    // organization context in that case to assign them to the org.
    if (this.pendingInvitation) {
      await fetchOrganizationByMember(
        this.api,
        this.pendingInvitation.memberId.toString(),
        {
          addOrg: true,
          fetchOrgDetails: true,
        }
      );
    }

    this.props.router.push('/settings/account/security/');
    openRecoveryOptions({authenticatorName: this.authenticatorName});

    // The remainder of this function is included primarily to smooth out the relocation flow. The
    // newly claimed user will have landed on `https://sentry.io/settings/account/security` to
    // perform the 2FA registration. But now that they have in fact registered, we want to redirect
    // them to the subdomain of the organization they are already a member of (ex:
    // `https://my-2fa-org.sentry.io`), but did not have the ability to access due to their previous
    // lack of 2FA enrollment.
    let orgs = OrganizationsStore.getAll();
    if (orgs.length === 0) {
      // Try to load orgs post 2FA again.
      orgs = await fetchOrganizations(this.api, {member: '1'});
      OrganizationsStore.load(orgs);

      // Still no orgs? Nowhere to redirect the user to, so just stay in place.
      if (orgs.length === 0) {
        return;
      }
    }

    // If we are already in an org sub-domain, we don't need to do any redirection. If we are not
    // (this is usually only the case for a newly claimed relocated user), we redirect to the org
    // slug's subdomain now.
    const isAlreadyInOrgSubDomain = orgs.some(org => {
      return org.links.organizationUrl === new URL(window.location.href).origin;
    });
    if (!isAlreadyInOrgSubDomain) {
      window.location.assign(generateOrgSlugUrl(orgs[0]!.slug));
    }
  }

  // Handler when we failed to add a 2fa device
  handleEnrollError() {
    this.setState({loading: false});
    addErrorMessage(t('Error adding %s authenticator', this.authenticatorName));
  }

  // Removes an authenticator
  handleRemove = async () => {
    const {authenticator} = this.state;

    if (!authenticator || !authenticator.authId) {
      return;
    }

    // `authenticator.authId` is NOT the same as `props.params.authId` This is
    // for backwards compatibility with API endpoint
    try {
      await this.api.requestPromise(this.authenticatorEndpoint, {method: 'DELETE'});
    } catch (err) {
      addErrorMessage(t('Error removing authenticator'));
      return;
    }

    this.props.router.push('/settings/account/security/');
    addSuccessMessage(t('Authenticator has been removed'));
  };

  renderBody() {
    const {authenticator, hasSentCode, sendingCode} = this.state;

    if (!authenticator) {
      return null;
    }

    const fields = getFields({
      authenticator,
      hasSentCode,
      sendingCode,
      onSmsReset: this.handleSmsReset,
      onU2fTap: this.handleU2fTap,
    });

    // Attempt to extract `defaultValue` from server generated form fields
    const defaultValues = fields
      ? fields
          .filter(
            field =>
              typeof field !== 'function' && typeof field.defaultValue !== 'undefined'
          )
          .map(field => [
            field.name,
            typeof field !== 'function' ? field.defaultValue : '',
          ])
          .reduce((acc, [name, value]) => {
            // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
            acc[name] = value;
            return acc;
          }, {})
      : {};

    const isActive = authenticator.isEnrolled || authenticator.status === 'rotation';

    return (
      <SentryDocumentTitle title={t('Security')}>
        <SettingsPageHeader
          title={
            <Fragment>
              <span>{authenticator.name}</span>
              <CircleIndicator
                role="status"
                aria-label={
                  isActive
                    ? t('Authentication Method Active')
                    : t('Authentication Method Inactive')
                }
                enabled={isActive}
                css={css`
                  margin-left: 6px;
                `}
              />
            </Fragment>
          }
          action={
            authenticator.isEnrolled &&
            authenticator.removeButton && (
              <RemoveConfirm onConfirm={this.handleRemove}>
                <Button priority="danger">{authenticator.removeButton}</Button>
              </RemoveConfirm>
            )
          }
        />

        <TextBlock>{authenticator.description}</TextBlock>

        {authenticator.rotationWarning && authenticator.status === 'rotation' && (
          <Alert type="warning" showIcon>
            {authenticator.rotationWarning}
          </Alert>
        )}

        {!!authenticator.form?.length && (
          <Form
            model={this.formModel}
            apiMethod="POST"
            apiEndpoint={this.authenticatorEndpoint}
            onSubmit={this.handleSubmit}
            initialData={{...defaultValues, ...authenticator}}
            hideFooter
          >
            <JsonForm forms={[{title: 'Configuration', fields: fields ?? []}]} />
          </Form>
        )}
      </SentryDocumentTitle>
    );
  }
}

const CodeContainer = styled(PanelItem)`
  justify-content: center;
`;

const Actions = styled(PanelItem)`
  justify-content: flex-end;
`;

const StyledQRCode = styled(QRCodeCanvas)`
  background: white;
  padding: ${space(2)};
`;

export default withSentryRouter(AccountSecurityEnroll);
