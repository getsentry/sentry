import {Fragment} from 'react';
import moment from 'moment-timezone';

import {Alert} from '@sentry/scraps/alert';
import {Tag} from '@sentry/scraps/badge';
import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {Heading, Text} from '@sentry/scraps/text';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {openModal} from 'sentry/actionCreators/modal';
import {TextField} from 'sentry/components/forms/fields/textField';
import {Form} from 'sentry/components/forms/form';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {Panel} from 'sentry/components/panels/panel';
import {PanelBody} from 'sentry/components/panels/panelBody';
import {PanelHeader} from 'sentry/components/panels/panelHeader';
import {fetchMutation, useApiQuery, useMutation} from 'sentry/utils/queryClient';
import type {RequestError} from 'sentry/utils/requestError/requestError';
import {useParams} from 'sentry/utils/useParams';

import {StartupFlags} from 'admin/components/startups/startupFlags';
import {StartupStatusBadge} from 'admin/components/startups/startupStatusBadge';

interface StartupApplication {
  contact_email: string;
  credits_amount: number | null;
  credits_applied_at: string | null;
  credits_tag: string | null;
  date_added: string;
  emails: StartupEmail[];
  flag_company_age: boolean;
  flag_possible_duplicate: boolean;
  founders_name: string;
  founding_date_text: string;
  funding_details: string;
  id: number;
  notes: string;
  org_slug: string;
  rejection_reason: string | null;
  reviewed_at: string | null;
  reviewer: {email: string; name: string} | null;
  startup_name: string;
  startup_website: string;
  status: string;
  submitted_by: {email: string; name: string} | null;
}

interface StartupEmail {
  body: string;
  date_added: string;
  id: number;
  sent_by: {email: string; name: string} | null;
  subject: string;
  template_name: string;
}

interface EmailTemplate {
  body: string;
  display_name: string;
  id: number;
  name: string;
  rejection_reason: string | null;
  subject: string;
}

const REJECTION_REASONS: Record<string, string> = {
  too_much_funding: 'Too Much Funding',
  already_paying: 'Already Paying',
  bad_org: 'Bad Org',
  duplicate: 'Duplicate',
  other: 'Other',
};

function RejectModal({
  closeModal,
  Header,
  Body,
  onReject,
}: ModalRenderProps & {onReject: (reason: string, notes: string) => void}) {
  return (
    <Fragment>
      <Header>
        <Heading as="h2">Reject Application</Heading>
      </Header>
      <Body>
        <Form
          onSubmit={(data: any) => {
            onReject(data.reason || 'other', data.notes || '');
            closeModal();
          }}
          onCancel={closeModal}
          submitLabel="Reject"
          cancelLabel="Cancel"
          footerClass="modal-footer"
        >
          <div>
            <label htmlFor="reason">
              <Text bold>Rejection Reason</Text>
            </label>
            <select
              id="reason"
              name="reason"
              style={{width: '100%', padding: '8px', marginTop: '4px'}}
            >
              {Object.entries(REJECTION_REASONS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <TextField
            name="notes"
            label="Notes (optional)"
            inline={false}
            stacked
            maxLength={500}
          />
        </Form>
      </Body>
    </Fragment>
  );
}

function SendEmailModal({
  closeModal,
  Header,
  Body,
  application,
  templates,
  onSend,
}: ModalRenderProps & {
  application: StartupApplication;
  onSend: (templateName: string) => void;
  templates: EmailTemplate[];
}) {
  const defaultTemplate =
    application.status === 'rejected' && application.rejection_reason
      ? templates.find(t => t.rejection_reason === application.rejection_reason)
      : templates.find(t => t.name === 'welcome_io');

  const mergeVariables = (text: string) =>
    text
      .replace(/\{\{name\}\}/g, application.founders_name)
      .replace(/\{\{company\}\}/g, application.startup_name)
      .replace(/\{\{slug\}\}/g, application.org_slug)
      .replace(/\{\{amount\}\}/g, '$5,000')
      .replace(/\{\{email\}\}/g, application.contact_email);

  return (
    <Fragment>
      <Header>
        <Heading as="h2">Send Email</Heading>
      </Header>
      <Body>
        <Form
          onSubmit={(data: any) => {
            onSend(data.template || defaultTemplate?.name || '');
            closeModal();
          }}
          onCancel={closeModal}
          submitLabel="Send Email"
          cancelLabel="Cancel"
          footerClass="modal-footer"
        >
          <div>
            <label htmlFor="template">
              <Text bold>Email Template</Text>
            </label>
            <select
              id="template"
              name="template"
              defaultValue={defaultTemplate?.name}
              style={{width: '100%', padding: '8px', marginTop: '4px'}}
            >
              {templates.map(t => (
                <option key={t.name} value={t.name}>
                  {t.display_name}
                </option>
              ))}
            </select>
          </div>
          {defaultTemplate && (
            <Panel>
              <PanelHeader>Preview</PanelHeader>
              <PanelBody>
                <Text bold>Subject: {mergeVariables(defaultTemplate.subject)}</Text>
                <Text
                  as="div"
                  style={{whiteSpace: 'pre-wrap', marginTop: '8px'}}
                >
                  {mergeVariables(defaultTemplate.body)}
                </Text>
              </PanelBody>
            </Panel>
          )}
        </Form>
      </Body>
    </Fragment>
  );
}

function InfoRow({label, children}: {children: React.ReactNode; label: string}) {
  return (
    <Flex gap="md" padding="sm 0">
      <Text bold style={{minWidth: 140}}>
        {label}
      </Text>
      <div>{children}</div>
    </Flex>
  );
}

export function StartupApplicationDetail() {
  const {applicationId} = useParams<{applicationId: string}>();

  const {
    data: application,
    isPending,
    isError,
    refetch,
  } = useApiQuery<StartupApplication>(
    [`/_admin/startups/applications/${applicationId}/`],
    {staleTime: 0}
  );

  const {data: templates} = useApiQuery<EmailTemplate[]>(
    ['/_admin/startups/email-templates/'],
    {staleTime: 60000}
  );

  const updateMutation = useMutation<
    StartupApplication,
    RequestError,
    {data: Record<string, any>; endpoint: string}
  >({
    mutationFn: ({endpoint, data}) =>
      fetchMutation({method: 'PUT', url: endpoint, data}),
    onSuccess: () => {
      refetch();
    },
    onError: () => {
      addErrorMessage('Failed to update application');
    },
  });

  const approveMutation = useMutation<
    StartupApplication,
    RequestError,
    void
  >({
    mutationFn: () =>
      fetchMutation({
        method: 'POST',
        url: `/_admin/startups/applications/${applicationId}/approve/`,
        data: {},
      }),
    onSuccess: () => {
      addSuccessMessage('Application approved and credits applied');
      refetch();
    },
    onError: () => {
      addErrorMessage('Failed to approve application');
    },
  });

  const rejectMutation = useMutation<
    StartupApplication,
    RequestError,
    {notes: string; reason: string}
  >({
    mutationFn: ({reason, notes}) =>
      fetchMutation({
        method: 'POST',
        url: `/_admin/startups/applications/${applicationId}/reject/`,
        data: {rejection_reason: reason, notes},
      }),
    onSuccess: () => {
      addSuccessMessage('Application rejected');
      refetch();
    },
    onError: () => {
      addErrorMessage('Failed to reject application');
    },
  });

  const sendEmailMutation = useMutation<
    Record<string, any>,
    RequestError,
    {templateName: string}
  >({
    mutationFn: ({templateName}) =>
      fetchMutation({
        method: 'POST',
        url: `/_admin/startups/applications/${applicationId}/send-email/`,
        data: {template_name: templateName},
      }),
    onSuccess: () => {
      addSuccessMessage('Email sent');
      refetch();
    },
    onError: () => {
      addErrorMessage('Failed to send email');
    },
  });

  if (isPending) {
    return <LoadingIndicator />;
  }

  if (isError || !application) {
    return <LoadingError onRetry={refetch} />;
  }

  const handleApprove = () => {
    addLoadingMessage('Approving and applying credits...');
    approveMutation.mutate();
  };

  const handleReject = (reason: string, notes: string) => {
    addLoadingMessage('Rejecting application...');
    rejectMutation.mutate({reason, notes});
  };

  const handleNeedsInfo = () => {
    addLoadingMessage('Updating status...');
    updateMutation.mutate({
      endpoint: `/_admin/startups/applications/${applicationId}/`,
      data: {status: 'needs_info'},
    });
  };

  const handleSendEmail = (templateName: string) => {
    addLoadingMessage('Sending email...');
    sendEmailMutation.mutate({templateName});
  };

  const handleNotesUpdate = (notes: string) => {
    updateMutation.mutate({
      endpoint: `/_admin/startups/applications/${applicationId}/`,
      data: {notes},
    });
  };

  const isPendingStatus = application.status === 'pending';
  const isNeedsInfo = application.status === 'needs_info';

  return (
    <div>
      <Flex justify="space-between" align="center" padding="md 0">
        <Flex align="center" gap="md">
          <Link to="/_admin/startups/">&larr; Back to queue</Link>
        </Flex>
      </Flex>

      <Flex gap="xl" align="flex-start">
        {/* Left column — Applicant Info */}
        <div style={{flex: 1}}>
          <Heading as="h1">{application.startup_name}</Heading>
          <Flex gap="sm" align="center" padding="sm 0">
            <StartupStatusBadge status={application.status} />
            <StartupFlags
              flagPossibleDuplicate={application.flag_possible_duplicate}
              flagCompanyAge={application.flag_company_age}
            />
          </Flex>

          {application.flag_possible_duplicate && (
            <Alert type="warning" showIcon>
              This org slug has an existing application. Check for duplicates.
            </Alert>
          )}
          {application.flag_company_age && (
            <Alert type="info" showIcon>
              Company may have been founded more than 2 years ago.
            </Alert>
          )}

          <Panel>
            <PanelHeader>Application Details</PanelHeader>
            <PanelBody>
              <InfoRow label="Startup Name">{application.startup_name}</InfoRow>
              <InfoRow label="Website">
                <a
                  href={application.startup_website}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {application.startup_website}
                </a>
              </InfoRow>
              <InfoRow label="Org Slug">
                <Link to={`/_admin/customers/${application.org_slug}/`}>
                  {application.org_slug}
                </Link>
              </InfoRow>
              <InfoRow label="Founders">{application.founders_name}</InfoRow>
              <InfoRow label="Contact Email">
                <a href={`mailto:${application.contact_email}`}>
                  {application.contact_email}
                </a>
              </InfoRow>
              <InfoRow label="Founded">{application.founding_date_text}</InfoRow>
              <InfoRow label="Funding Details">{application.funding_details}</InfoRow>
              <InfoRow label="Applied">
                {moment(application.date_added).format('MMMM D, YYYY h:mm A')}
              </InfoRow>
              {application.submitted_by && (
                <InfoRow label="Submitted By">
                  {application.submitted_by.email}
                </InfoRow>
              )}
            </PanelBody>
          </Panel>

          {/* Quick links */}
          <Panel>
            <PanelHeader>Quick Links</PanelHeader>
            <PanelBody>
              <Flex direction="column" gap="sm">
                <a
                  href={`https://www.google.com/search?q=${encodeURIComponent(application.startup_name + ' funding')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Google &ldquo;{application.startup_name} funding&rdquo;
                </a>
                <Link to={`/_admin/customers/${application.org_slug}/`}>
                  View in Customer Admin
                </Link>
              </Flex>
            </PanelBody>
          </Panel>
        </div>

        {/* Right column — Reviewer Actions */}
        <div style={{flex: 1, maxWidth: 480}}>
          {/* Decision buttons */}
          {(isPendingStatus || isNeedsInfo) && (
            <Panel>
              <PanelHeader>Review Decision</PanelHeader>
              <PanelBody>
                <Flex gap="md">
                  <Button
                    priority="primary"
                    onClick={handleApprove}
                    disabled={approveMutation.isPending}
                  >
                    Approve
                  </Button>
                  <Button
                    priority="danger"
                    onClick={() =>
                      openModal(deps => (
                        <RejectModal {...deps} onReject={handleReject} />
                      ))
                    }
                    disabled={rejectMutation.isPending}
                  >
                    Reject
                  </Button>
                  {isPendingStatus && (
                    <Button
                      onClick={handleNeedsInfo}
                      disabled={updateMutation.isPending}
                    >
                      Needs Info
                    </Button>
                  )}
                </Flex>
              </PanelBody>
            </Panel>
          )}

          {/* Credits info (after approval) */}
          {application.credits_applied_at && (
            <Panel>
              <PanelHeader>Credits Applied</PanelHeader>
              <PanelBody>
                <InfoRow label="Amount">
                  ${((application.credits_amount ?? 0) / 100).toLocaleString()}
                </InfoRow>
                <InfoRow label="Tag">
                  <Tag>{application.credits_tag}</Tag>
                </InfoRow>
                <InfoRow label="Applied At">
                  {moment(application.credits_applied_at).format(
                    'MMMM D, YYYY h:mm A'
                  )}
                </InfoRow>
              </PanelBody>
            </Panel>
          )}

          {/* Rejection info */}
          {application.status === 'rejected' && application.rejection_reason && (
            <Panel>
              <PanelHeader>Rejection Details</PanelHeader>
              <PanelBody>
                <InfoRow label="Reason">
                  {REJECTION_REASONS[application.rejection_reason] ??
                    application.rejection_reason}
                </InfoRow>
              </PanelBody>
            </Panel>
          )}

          {/* Notes */}
          <Panel>
            <PanelHeader>Internal Notes</PanelHeader>
            <PanelBody>
              <textarea
                defaultValue={application.notes}
                onBlur={e => handleNotesUpdate(e.target.value)}
                rows={4}
                style={{width: '100%', padding: '8px'}}
                placeholder="Add internal notes here..."
              />
            </PanelBody>
          </Panel>

          {/* Email panel */}
          {application.status !== 'pending' && (
            <Panel>
              <PanelHeader>
                <Flex justify="space-between" align="center" style={{width: '100%'}}>
                  <span>Emails</span>
                  <Button
                    size="xs"
                    onClick={() =>
                      openModal(deps => (
                        <SendEmailModal
                          {...deps}
                          application={application}
                          templates={templates ?? []}
                          onSend={handleSendEmail}
                        />
                      ))
                    }
                    disabled={sendEmailMutation.isPending}
                  >
                    Send Email
                  </Button>
                </Flex>
              </PanelHeader>
              <PanelBody>
                {application.emails.length === 0 ? (
                  <Text variant="muted">No emails sent yet.</Text>
                ) : (
                  <Flex direction="column" gap="md">
                    {application.emails.map(email => (
                      <div key={email.id}>
                        <Flex justify="space-between">
                          <Text bold>{email.template_name}</Text>
                          <Text size="sm" variant="muted">
                            {moment(email.date_added).format('MMM D, YYYY h:mm A')}
                          </Text>
                        </Flex>
                        <Text size="sm">Subject: {email.subject}</Text>
                        {email.sent_by && (
                          <Text size="sm" variant="muted">
                            Sent by: {email.sent_by.email}
                          </Text>
                        )}
                      </div>
                    ))}
                  </Flex>
                )}
              </PanelBody>
            </Panel>
          )}

          {/* Reviewer info */}
          {application.reviewer && (
            <Panel>
              <PanelHeader>Reviewed By</PanelHeader>
              <PanelBody>
                <InfoRow label="Reviewer">{application.reviewer.email}</InfoRow>
                {application.reviewed_at && (
                  <InfoRow label="Reviewed At">
                    {moment(application.reviewed_at).format('MMMM D, YYYY h:mm A')}
                  </InfoRow>
                )}
              </PanelBody>
            </Panel>
          )}
        </div>
      </Flex>
    </div>
  );
}
