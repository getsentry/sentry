from django.urls import re_path
from django.views.generic import TemplateView

import sentry.web.frontend.debug.mail
from sentry.web.frontend.debug import debug_auth_views
from sentry.web.frontend.debug.debug_assigned_email import (
    DebugAssignedEmailView,
    DebugSelfAssignedEmailView,
    DebugSelfAssignedTeamEmailView,
)
from sentry.web.frontend.debug.debug_chart_renderer import DebugChartRendererView
from sentry.web.frontend.debug.debug_codeowners_auto_sync_failure_email import (
    DebugCodeOwnersAutoSyncFailureView,
)
from sentry.web.frontend.debug.debug_codeowners_request_mail import DebugCodeOwnersRequestView
from sentry.web.frontend.debug.debug_error_embed import DebugErrorPageEmbedView
from sentry.web.frontend.debug.debug_incident_activity_email import DebugIncidentActivityEmailView
from sentry.web.frontend.debug.debug_incident_trigger_email import DebugIncidentTriggerEmailView
from sentry.web.frontend.debug.debug_invalid_identity_email import DebugInvalidIdentityEmailView
from sentry.web.frontend.debug.debug_mfa_added_email import DebugMfaAddedEmailView
from sentry.web.frontend.debug.debug_mfa_removed_email import DebugMfaRemovedEmailView
from sentry.web.frontend.debug.debug_new_processing_issues_email import (
    DebugNewProcessingIssuesEmailView,
    DebugNewProcessingIssuesNoReprocessingEmailView,
)
from sentry.web.frontend.debug.debug_new_release_email import DebugNewReleaseEmailView
from sentry.web.frontend.debug.debug_new_user_feedback_email import DebugNewUserFeedbackEmailView
from sentry.web.frontend.debug.debug_note_email import DebugNoteEmailView
from sentry.web.frontend.debug.debug_oauth_authorize import (
    DebugOAuthAuthorizeErrorView,
    DebugOAuthAuthorizeView,
)
from sentry.web.frontend.debug.debug_organization_invite_request import (
    DebugOrganizationInviteRequestEmailView,
)
from sentry.web.frontend.debug.debug_organization_join_request import (
    DebugOrganizationJoinRequestEmailView,
)
from sentry.web.frontend.debug.debug_password_changed_email import DebugPasswordChangedEmailView
from sentry.web.frontend.debug.debug_recovery_codes_regenerated_email import (
    DebugRecoveryCodesRegeneratedEmailView,
)
from sentry.web.frontend.debug.debug_regression_email import (
    DebugRegressionEmailView,
    DebugRegressionReleaseEmailView,
)
from sentry.web.frontend.debug.debug_resolved_email import DebugResolvedEmailView
from sentry.web.frontend.debug.debug_resolved_in_release_email import (
    DebugResolvedInReleaseEmailView,
    DebugResolvedInReleaseUpcomingEmailView,
)
from sentry.web.frontend.debug.debug_setup_2fa_email import DebugSetup2faEmailView
from sentry.web.frontend.debug.debug_sso_link_email import (
    DebugSsoLinkedEmailView,
    DebugSsoUnlinkedEmailView,
    DebugSsoUnlinkedNoPasswordEmailView,
)
from sentry.web.frontend.debug.debug_trigger_error import DebugTriggerErrorView
from sentry.web.frontend.debug.debug_unable_to_delete_repository import (
    DebugUnableToDeleteRepository,
)
from sentry.web.frontend.debug.debug_unable_to_fetch_commits_email import (
    DebugUnableToFetchCommitsEmailView,
)
from sentry.web.frontend.debug.debug_unassigned_email import DebugUnassignedEmailView

urlpatterns = [
    re_path("^debug/mail/alert", sentry.web.frontend.debug.mail.alert),
    re_path("^debug/mail/note", DebugNoteEmailView.as_view()),
    re_path("^debug/mail/new-release", DebugNewReleaseEmailView.as_view()),
    re_path("^debug/mail/new-user-feedback", DebugNewUserFeedbackEmailView.as_view()),
    re_path("^debug/mail/assigned/self", DebugSelfAssignedEmailView.as_view()),
    re_path("^debug/mail/assigned/team", DebugSelfAssignedTeamEmailView.as_view()),
    re_path("^debug/mail/assigned", DebugAssignedEmailView.as_view()),
    re_path(
        "^debug/mail/codeowners_auto_sync_failure", DebugCodeOwnersAutoSyncFailureView.as_view()
    ),
    re_path("^debug/mail/digest", sentry.web.frontend.debug.mail.digest),
    re_path("^debug/mail/report", sentry.web.frontend.debug.mail.report),
    re_path("^debug/mail/regression/release", DebugRegressionReleaseEmailView.as_view()),
    re_path("^debug/mail/regression", DebugRegressionEmailView.as_view()),
    re_path(
        "^debug/mail/resolved-in-release/upcoming",
        DebugResolvedInReleaseUpcomingEmailView.as_view(),
    ),
    re_path("^debug/mail/resolved-in-release", DebugResolvedInReleaseEmailView.as_view()),
    re_path("^debug/mail/resolved", DebugResolvedEmailView.as_view()),
    re_path(
        "^debug/mail/request-access-for-another-member",
        sentry.web.frontend.debug.mail.request_access_for_another_member,
    ),
    re_path("^debug/mail/request-access", sentry.web.frontend.debug.mail.request_access),
    re_path("^debug/mail/join-request", DebugOrganizationJoinRequestEmailView.as_view()),
    re_path("^debug/mail/invite-request", DebugOrganizationInviteRequestEmailView.as_view()),
    re_path("^debug/mail/access-approved", sentry.web.frontend.debug.mail.access_approved),
    re_path("^debug/mail/invitation", sentry.web.frontend.debug.mail.invitation),
    re_path("^debug/mail/invalid-identity", DebugInvalidIdentityEmailView.as_view()),
    re_path("^debug/mail/codeowners-request", DebugCodeOwnersRequestView.as_view()),
    re_path("^debug/mail/confirm-email", sentry.web.frontend.debug.mail.confirm_email),
    re_path("^debug/mail/recover-account", sentry.web.frontend.debug.mail.recover_account),
    re_path("^debug/mail/unable-to-delete-repo", DebugUnableToDeleteRepository.as_view()),
    re_path("^debug/mail/unable-to-fetch-commits", DebugUnableToFetchCommitsEmailView.as_view()),
    re_path("^debug/mail/unassigned", DebugUnassignedEmailView.as_view()),
    re_path("^debug/mail/org-delete-confirm", sentry.web.frontend.debug.mail.org_delete_confirm),
    re_path("^debug/mail/mfa-removed", DebugMfaRemovedEmailView.as_view()),
    re_path("^debug/mail/mfa-added", DebugMfaAddedEmailView.as_view()),
    re_path(
        "^debug/mail/recovery-codes-regenerated",
        DebugRecoveryCodesRegeneratedEmailView.as_view(),
    ),
    re_path("^debug/mail/password-changed", DebugPasswordChangedEmailView.as_view()),
    re_path(
        "^debug/mail/new-processing-issues-no-reprocessing",
        DebugNewProcessingIssuesNoReprocessingEmailView.as_view(),
    ),
    re_path("^debug/mail/new-processing-issues", DebugNewProcessingIssuesEmailView.as_view()),
    re_path("^debug/mail/sso-linked", DebugSsoLinkedEmailView.as_view()),
    re_path("^debug/mail/sso-unlinked/no-password", DebugSsoUnlinkedNoPasswordEmailView.as_view()),
    re_path("^debug/mail/sso-unlinked", DebugSsoUnlinkedEmailView.as_view()),
    re_path("^debug/mail/incident-activity", DebugIncidentActivityEmailView.as_view()),
    re_path("^debug/mail/incident-trigger", DebugIncidentTriggerEmailView.as_view()),
    re_path("^debug/mail/setup-2fa", DebugSetup2faEmailView.as_view()),
    re_path("^debug/embed/error-page", DebugErrorPageEmbedView.as_view()),
    re_path("^debug/trigger-error", DebugTriggerErrorView.as_view()),
    re_path("^debug/auth-confirm-identity", debug_auth_views.DebugAuthConfirmIdentity.as_view()),
    re_path("^debug/auth-confirm-link", debug_auth_views.DebugAuthConfirmLink.as_view()),
    re_path("^debug/sudo", TemplateView.as_view(template_name="sentry/account/sudo.html")),
    re_path("^debug/oauth/authorize/error", DebugOAuthAuthorizeErrorView.as_view()),
    re_path("^debug/oauth/authorize", DebugOAuthAuthorizeView.as_view()),
    re_path("^debug/chart-renderer", DebugChartRendererView.as_view()),
]
