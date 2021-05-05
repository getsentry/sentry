import re

from django.conf import settings
from django.conf.urls import include, url
from django.http import HttpResponse
from django.views.generic import RedirectView

from sentry.auth.providers.saml2.provider import SAML2AcceptACSView, SAML2MetadataView, SAML2SLSView
from sentry.charts.endpoints import serve_chartcuterie_config
from sentry.web import api
from sentry.web.frontend import accounts, generic
from sentry.web.frontend.account_identity import AccountIdentityAssociateView
from sentry.web.frontend.auth_close import AuthCloseView
from sentry.web.frontend.auth_login import AuthLoginView
from sentry.web.frontend.auth_logout import AuthLogoutView
from sentry.web.frontend.auth_organization_login import AuthOrganizationLoginView
from sentry.web.frontend.auth_provider_login import AuthProviderLoginView
from sentry.web.frontend.error_page_embed import ErrorPageEmbedView
from sentry.web.frontend.group_event_json import GroupEventJsonView
from sentry.web.frontend.group_plugin_action import GroupPluginActionView
from sentry.web.frontend.group_tag_export import GroupTagExportView
from sentry.web.frontend.home import HomeView
from sentry.web.frontend.js_sdk_loader import JavaScriptSdkLoader
from sentry.web.frontend.mailgun_inbound_webhook import MailgunInboundWebhookView
from sentry.web.frontend.oauth_authorize import OAuthAuthorizeView
from sentry.web.frontend.oauth_token import OAuthTokenView
from sentry.web.frontend.organization_auth_settings import OrganizationAuthSettingsView
from sentry.web.frontend.organization_avatar import OrganizationAvatarPhotoView
from sentry.web.frontend.organization_integration_setup import OrganizationIntegrationSetupView
from sentry.web.frontend.out import OutView
from sentry.web.frontend.pipeline_advancer import PipelineAdvancerView
from sentry.web.frontend.project_avatar import ProjectAvatarPhotoView
from sentry.web.frontend.project_event import ProjectEventRedirect
from sentry.web.frontend.react_page import GenericReactPageView, ReactPageView
from sentry.web.frontend.reactivate_account import ReactivateAccountView
from sentry.web.frontend.release_webhook import ReleaseWebhookView
from sentry.web.frontend.restore_organization import RestoreOrganizationView
from sentry.web.frontend.setup_wizard import SetupWizardView
from sentry.web.frontend.sudo import SudoView
from sentry.web.frontend.team_avatar import TeamAvatarPhotoView
from sentry.web.frontend.twofactor import TwoFactorAuthView, u2f_appid
from sentry.web.frontend.unsubscribe_incident_notifications import (
    UnsubscribeIncidentNotificationsView,
)
from sentry.web.frontend.unsubscribe_issue_notifications import UnsubscribeIssueNotificationsView
from sentry.web.frontend.user_avatar import UserAvatarPhotoView

__all__ = ("urlpatterns",)


# Only create one instance of the ReactPageView since it's duplicated everywhere
generic_react_page_view = GenericReactPageView.as_view()
react_page_view = ReactPageView.as_view()

urlpatterns = []

if getattr(settings, "DEBUG_VIEWS", settings.DEBUG):
    from sentry.web.debug_urls import urlpatterns as debug_urls

    urlpatterns += debug_urls

if getattr(settings, "SERVE_UPLOADED_FILES", settings.DEBUG):
    from django.views.static import serve

    # Serve FileSystemStorage files in development. In production this
    # would typically be handled by some static server.
    urlpatterns += [
        url(
            r"^{}(?P<path>.*)$".format(re.escape(settings.MEDIA_URL)),
            serve,
            {"document_root": settings.MEDIA_ROOT},
            name="sentry-serve-media",
        )
    ]

if settings.DEBUG:
    # Special favicon in debug mode
    urlpatterns += [
        url(
            r"^_static/[^/]+/[^/]+/images/favicon\.(ico|png)$",
            generic.dev_favicon,
            name="sentry-dev-favicon",
        ),
    ]

urlpatterns += [
    url(
        r"^api/(?P<project_id>[\w_-]+)/crossdomain\.xml$",
        api.crossdomain_xml,
        name="sentry-api-crossdomain-xml",
    ),
    # Frontend client config
    url(r"^api/client-config/?$", api.ClientConfigView.as_view(), name="sentry-api-client-config"),
    # We do not want to have webpack assets served under a versioned URL, as these assets have
    # a filecontent-based hash in its filenames so that it can be cached long term
    url(
        r"^_static/dist/(?P<module>[^/]+)/(?P<path>.*)$",
        generic.static_media_with_manifest,
        name="sentry-webpack-media",
    ),
    # The static version is either a 10 digit timestamp, a sha1, or md5 hash
    url(
        r"^_static/(?:(?P<version>\d{10}|[a-f0-9]{32,40})/)?(?P<module>[^/]+)/(?P<path>.*)$",
        generic.static_media,
        name="sentry-media",
    ),
    # Javascript SDK Loader
    url(
        r"^js-sdk-loader/(?P<public_key>[^/\.]+)(?:(?P<minified>\.min))?\.js$",
        JavaScriptSdkLoader.as_view(),
        name="sentry-js-sdk-loader",
    ),
    # Versioned API
    url(r"^api/0/", include("sentry.api.urls")),
    # Legacy unversioned endpoints
    url(
        r"^api/hooks/mailgun/inbound/",
        MailgunInboundWebhookView.as_view(),
        name="sentry-mailgun-inbound-hook",
    ),
    url(
        r"^api/hooks/release/(?P<plugin_id>[^/]+)/(?P<project_id>[^/]+)/(?P<signature>[^/]+)/",
        ReleaseWebhookView.as_view(),
        name="sentry-release-hook",
    ),
    url(r"^api/embed/error-page/$", ErrorPageEmbedView.as_view(), name="sentry-error-page-embed"),
    # OAuth
    url(
        r"^oauth/",
        include(
            [
                url(r"^authorize/$", OAuthAuthorizeView.as_view()),
                url(r"^token/$", OAuthTokenView.as_view()),
            ]
        ),
    ),
    # SAML
    url(
        r"^saml/",
        include(
            [
                url(
                    r"^acs/(?P<organization_slug>[^/]+)/$",
                    SAML2AcceptACSView.as_view(),
                    name="sentry-auth-organization-saml-acs",
                ),
                url(
                    r"^sls/(?P<organization_slug>[^/]+)/$",
                    SAML2SLSView.as_view(),
                    name="sentry-auth-organization-saml-sls",
                ),
                url(
                    r"^metadata/(?P<organization_slug>[^/]+)/$",
                    SAML2MetadataView.as_view(),
                    name="sentry-auth-organization-saml-metadata",
                ),
            ]
        ),
    ),
    # Auth
    url(
        r"^auth/",
        include(
            [
                url(r"^login/$", AuthLoginView.as_view(), name="sentry-login"),
                url(
                    r"^login/(?P<organization_slug>[^/]+)/$",
                    AuthOrganizationLoginView.as_view(),
                    name="sentry-auth-organization",
                ),
                url(
                    r"^link/(?P<organization_slug>[^/]+)/$",
                    AuthOrganizationLoginView.as_view(),
                    name="sentry-auth-link-identity",
                ),
                url(r"^2fa/$", TwoFactorAuthView.as_view(), name="sentry-2fa-dialog"),
                url(r"^2fa/u2fappid\.json$", u2f_appid, name="sentry-u2f-app-id"),
                url(r"^sso/$", AuthProviderLoginView.as_view(), name="sentry-auth-sso"),
                url(r"^logout/$", AuthLogoutView.as_view(), name="sentry-logout"),
                url(
                    r"^reactivate/$",
                    ReactivateAccountView.as_view(),
                    name="sentry-reactivate-account",
                ),
                url(r"^register/$", AuthLoginView.as_view(), name="sentry-register"),
                url(r"^close/$", AuthCloseView.as_view(), name="sentry-auth-close"),
            ]
        ),
    ),
    url(r"^login-redirect/$", accounts.login_redirect, name="sentry-login-redirect"),
    # Account
    url(
        r"^account/",
        include(
            [
                url(r"^sudo/$", SudoView.as_view(), name="sentry-sudo"),
                url(
                    r"^confirm-email/$",
                    accounts.start_confirm_email,
                    name="sentry-account-confirm-email-send",
                ),
                url(
                    r"^authorizations/$",
                    RedirectView.as_view(
                        pattern_name="sentry-account-settings-authorizations", permanent=False
                    ),
                ),
                url(
                    r"^confirm-email/(?P<user_id>[\d]+)/(?P<hash>[0-9a-zA-Z]+)/$",
                    accounts.confirm_email,
                    name="sentry-account-confirm-email",
                ),
                url(r"^recover/$", accounts.recover, name="sentry-account-recover"),
                url(
                    r"^recover/confirm/(?P<user_id>[\d]+)/(?P<hash>[0-9a-zA-Z]+)/$",
                    accounts.recover_confirm,
                    name="sentry-account-recover-confirm",
                ),
                url(
                    r"^password/confirm/(?P<user_id>[\d]+)/(?P<hash>[0-9a-zA-Z]+)/$",
                    accounts.set_password_confirm,
                    name="sentry-account-set-password-confirm",
                ),
                url(
                    r"^settings/$",
                    RedirectView.as_view(pattern_name="sentry-account-settings", permanent=False),
                ),
                url(
                    r"^settings/2fa/",
                    RedirectView.as_view(
                        pattern_name="sentry-account-settings-security", permanent=False
                    ),
                ),
                url(
                    r"^settings/avatar/$",
                    RedirectView.as_view(
                        pattern_name="sentry-account-settings-avatar", permanent=False
                    ),
                ),
                url(
                    r"^settings/appearance/$",
                    RedirectView.as_view(
                        pattern_name="sentry-account-settings-appearance", permanent=False
                    ),
                ),
                url(
                    r"^settings/identities/$",
                    RedirectView.as_view(
                        pattern_name="sentry-account-settings-identities", permanent=False
                    ),
                ),
                url(
                    r"^settings/subscriptions/$",
                    RedirectView.as_view(
                        pattern_name="sentry-account-settings-subscriptions", permanent=False
                    ),
                ),
                url(
                    r"^settings/identities/associate/(?P<organization_slug>[^\/]+)/(?P<provider_key>[^\/]+)/(?P<external_id>[^\/]+)/$",
                    AccountIdentityAssociateView.as_view(),
                    name="sentry-account-associate-identity",
                ),
                url(
                    r"^settings/security/",
                    RedirectView.as_view(
                        pattern_name="sentry-account-settings-security", permanent=False
                    ),
                ),
                url(
                    r"^settings/emails/$",
                    RedirectView.as_view(
                        pattern_name="sentry-account-settings-emails", permanent=False
                    ),
                ),
                # Project Wizard
                url(
                    r"^settings/wizard/(?P<wizard_hash>[^\/]+)/$",
                    SetupWizardView.as_view(),
                    name="sentry-project-wizard-fetch",
                ),
                # compatibility
                url(
                    r"^settings/notifications/unsubscribe/(?P<project_id>\d+)/$",
                    accounts.email_unsubscribe_project,
                ),
                url(
                    r"^settings/notifications/",
                    RedirectView.as_view(
                        pattern_name="sentry-account-settings-notifications", permanent=False
                    ),
                ),
                url(
                    r"^notifications/unsubscribe/(?P<project_id>\d+)/$",
                    accounts.email_unsubscribe_project,
                    name="sentry-account-email-unsubscribe-project",
                ),
                url(
                    r"^notifications/unsubscribe/issue/(?P<issue_id>\d+)/$",
                    UnsubscribeIssueNotificationsView.as_view(),
                    name="sentry-account-email-unsubscribe-issue",
                ),
                url(
                    r"^notifications/unsubscribe/incident/(?P<incident_id>\d+)/$",
                    UnsubscribeIncidentNotificationsView.as_view(),
                    name="sentry-account-email-unsubscribe-incident",
                ),
                url(
                    r"^remove/$",
                    RedirectView.as_view(pattern_name="sentry-remove-account", permanent=False),
                ),
                url(r"^settings/social/", include("social_auth.urls")),
                url(r"^", generic_react_page_view),
            ]
        ),
    ),
    # Onboarding
    url(r"^onboarding/", generic_react_page_view),
    # Admin
    url(r"^manage/", react_page_view, name="sentry-admin-overview"),
    # Legacy Redirects
    url(
        r"^docs/?$",
        RedirectView.as_view(url="https://docs.sentry.io/", permanent=False),
        name="sentry-docs-redirect",
    ),
    url(
        r"^docs/api/?$",
        RedirectView.as_view(url="https://docs.sentry.io/api/", permanent=False),
        name="sentry-api-docs-redirect",
    ),
    url(r"^api/$", RedirectView.as_view(pattern_name="sentry-api", permanent=False)),
    url(
        r"^api/applications/$",
        RedirectView.as_view(pattern_name="sentry-api-applications", permanent=False),
    ),
    url(
        r"^api/new-token/$",
        RedirectView.as_view(pattern_name="sentry-api-new-auth-token", permanent=False),
    ),
    url(r"^api/[^0]+/", RedirectView.as_view(pattern_name="sentry-api", permanent=False)),
    url(r"^out/$", OutView.as_view()),
    url(r"^accept-transfer/$", react_page_view, name="sentry-accept-project-transfer"),
    url(
        r"^accept/(?P<member_id>\d+)/(?P<token>\w+)/$",
        GenericReactPageView.as_view(auth_required=False),
        name="sentry-accept-invite",
    ),
    # User settings use generic_react_page_view, while any view acting on
    # behalf of an organization should use react_page_view
    url(
        r"^settings/",
        include(
            [
                url(r"^account/$", generic_react_page_view, name="sentry-account-settings"),
                url(
                    r"^account/$",
                    generic_react_page_view,
                    name="sentry-account-settings-appearance",
                ),
                url(
                    r"^account/authorizations/$",
                    generic_react_page_view,
                    name="sentry-account-settings-authorizations",
                ),
                url(
                    r"^account/security/",
                    generic_react_page_view,
                    name="sentry-account-settings-security",
                ),
                url(
                    r"^account/avatar/$",
                    generic_react_page_view,
                    name="sentry-account-settings-avatar",
                ),
                url(
                    r"^account/identities/$",
                    generic_react_page_view,
                    name="sentry-account-settings-identities",
                ),
                url(
                    r"^account/subscriptions/$",
                    generic_react_page_view,
                    name="sentry-account-settings-subscriptions",
                ),
                url(
                    r"^account/notifications/",
                    generic_react_page_view,
                    name="sentry-account-settings-notifications",
                ),
                url(
                    r"^account/emails/$",
                    generic_react_page_view,
                    name="sentry-account-settings-emails",
                ),
                url(
                    r"^account/api/applications/$",
                    generic_react_page_view,
                    name="sentry-api-applications",
                ),
                url(
                    r"^account/api/auth-tokens/new-token/$",
                    generic_react_page_view,
                    name="sentry-api-new-auth-token",
                ),
                url(r"^account/api/", generic_react_page_view, name="sentry-api"),
                url(
                    r"^account/close-account/$",
                    generic_react_page_view,
                    name="sentry-remove-account",
                ),
                url(r"^account/", generic_react_page_view),
                url(
                    r"^(?P<organization_slug>[\w_-]+)/$",
                    react_page_view,
                    name="sentry-organization-settings",
                ),
                url(
                    r"^(?P<organization_slug>[\w_-]+)/members/$",
                    react_page_view,
                    name="sentry-organization-members",
                ),
                url(
                    r"^(?P<organization_slug>[\w_-]+)/members/requests/$",
                    react_page_view,
                    name="sentry-organization-members-requests",
                ),
                url(
                    r"^(?P<organization_slug>[\w_-]+)/members/(?P<member_id>\d+)/$",
                    react_page_view,
                    name="sentry-organization-member-settings",
                ),
                url(
                    r"^(?P<organization_slug>[\w_-]+)/auth/$",
                    react_page_view,
                    name="sentry-organization-auth-settings",
                ),
                url(r"^(?P<organization_slug>[\w_-]+)/[\w_-]+/$", react_page_view),
                url(r"^", react_page_view),
            ]
        ),
    ),
    url(
        r"^extensions/external-install/(?P<provider_id>\w+)/(?P<installation_id>\w+)/$",
        react_page_view,
        name="integration-installation",
    ),
    # Organizations
    url(r"^(?P<organization_slug>[\w_-]+)/$", react_page_view, name="sentry-organization-home"),
    url(
        r"^organizations/",
        include(
            [
                url(r"^new/$", generic_react_page_view),
                url(
                    r"^(?P<organization_slug>[\w_-]+)/$",
                    react_page_view,
                    name="sentry-organization-index",
                ),
                url(
                    r"^(?P<organization_slug>[\w_-]+)/issues/$",
                    react_page_view,
                    name="sentry-organization-issue-list",
                ),
                url(
                    # See src.sentry.models.group.Group.get_absolute_url if this changes
                    r"^(?P<organization_slug>[\w_-]+)/issues/(?P<group_id>\d+)/$",
                    react_page_view,
                    name="sentry-organization-issue",
                ),
                url(
                    r"^(?P<organization_slug>[\w_-]+)/issues/(?P<issue_id>\d+)/$",
                    react_page_view,
                    name="sentry-organization-issue-detail",
                ),
                url(
                    r"^(?P<organization_slug>[\w_-]+)/issues/(?P<group_id>\d+)/events/(?P<event_id_or_latest>[\w-]+)/$",
                    react_page_view,
                    name="sentry-organization-event-detail",
                ),
                url(
                    r"^(?P<organization_slug>[\w_-]+)/data-export/(?P<data_export_id>\d+)/$",
                    react_page_view,
                    name="sentry-data-export-details",
                ),
                url(
                    r"^(?P<organization_slug>[\w_-]+)/issues/(?P<group_id>\d+)/events/(?P<event_id_or_latest>[\w-]+)/json/$",
                    GroupEventJsonView.as_view(),
                    name="sentry-group-event-json",
                ),
                url(
                    r"^(?P<organization_slug>[\w_-]+)/projects/(?P<project_slug>[\w_-]+)/events/(?P<client_event_id>[\w_-]+)/$",
                    ProjectEventRedirect.as_view(),
                    name="sentry-project-event-redirect",
                ),
                url(
                    r"^(?P<organization_slug>[\w_-]+)/api-keys/$",
                    react_page_view,
                    name="sentry-organization-api-keys",
                ),
                url(
                    r"^(?P<organization_slug>[\w_-]+)/api-keys/(?P<key_id>[\w_-]+)/$",
                    react_page_view,
                    name="sentry-organization-api-key-settings",
                ),
                url(
                    r"^(?P<organization_slug>[\w_-]+)/auth/configure/$",
                    OrganizationAuthSettingsView.as_view(),
                    name="sentry-organization-auth-provider-settings",
                ),
                url(
                    r"^(?P<organization_slug>[\w_-]+)/integrations/(?P<provider_id>[\w_-]+)/setup/$",
                    OrganizationIntegrationSetupView.as_view(),
                    name="sentry-organization-integrations-setup",
                ),
                url(
                    r"^(?P<organization_slug>[\w_-]+)/members/$",
                    RedirectView.as_view(
                        pattern_name="sentry-organization-members", permanent=False
                    ),
                    name="sentry-organization-members-old",
                ),
                url(
                    r"^(?P<organization_slug>[\w_-]+)/members/(?P<member_id>\d+)/$",
                    RedirectView.as_view(
                        pattern_name="sentry-organization-member-settings", permanent=False
                    ),
                    name="sentry-organization-member-settings-old",
                ),
                url(
                    r"^(?P<organization_slug>[\w_-]+)/stats/$",
                    react_page_view,
                    name="sentry-organization-stats",
                ),
                url(
                    r"^(?P<organization_slug>[\w_-]+)/restore/$",
                    RestoreOrganizationView.as_view(),
                    name="sentry-restore-organization",
                ),
                # need to force these to React and ensure organization_slug is captured
                # TODO(RyanSkonnord): Generalize to all pages without regressing
                url(r"^(?P<organization_slug>[\w_-]+)/(settings|discover)/", react_page_view),
            ]
        ),
    ),
    # Settings - Projects
    url(
        r"^(?P<organization_slug>[\w_-]+)/(?P<project_slug>[\w_-]+)/settings/$",
        RedirectView.as_view(pattern_name="sentry-manage-project", permanent=False),
    ),
    url(
        r"^settings/(?P<organization_slug>[\w_-]+)/projects/(?P<project_slug>[\w_-]+)/$",
        react_page_view,
        name="sentry-manage-project",
    ),
    url(
        r"^avatar/(?P<avatar_id>[^\/]+)/$",
        UserAvatarPhotoView.as_view(),
        name="sentry-user-avatar-url",
    ),
    url(
        r"^organization-avatar/(?P<avatar_id>[^\/]+)/$",
        OrganizationAvatarPhotoView.as_view(),
        name="sentry-organization-avatar-url",
    ),
    url(
        r"^project-avatar/(?P<avatar_id>[^\/]+)/$",
        ProjectAvatarPhotoView.as_view(),
        name="sentry-project-avatar-url",
    ),
    url(
        r"^team-avatar/(?P<avatar_id>[^\/]+)/$",
        TeamAvatarPhotoView.as_view(),
        name="sentry-team-avatar-url",
    ),
    # Serve chartcuterie configuration module
    url(
        r"^_chartcuterie-config.js$",
        serve_chartcuterie_config,
        name="sentry-chartcuterie-config",
    ),
    # Generic
    url(r"^$", HomeView.as_view(), name="sentry"),
    url(r"^robots\.txt$", api.robots_txt, name="sentry-api-robots-txt"),
    # Force a 404 of favicon.ico.
    # This url is commonly requested by browsers, and without
    # blocking this, it was treated as a 200 OK for a react page view.
    # A side effect of this is it may cause a bad redirect when logging in
    # since this gets stored in session as the last viewed page.
    # See: https://github.com/getsentry/sentry/issues/2195
    url(r"favicon\.ico$", lambda r: HttpResponse(status=404)),
    # crossdomain.xml
    url(r"^crossdomain\.xml$", lambda r: HttpResponse(status=404)),
    # plugins
    # XXX(dcramer): preferably we'd be able to use 'integrations' as the URL
    # prefix here, but unfortunately sentry.io has that mapped to marketing
    # assets for the time being
    url(
        r"^extensions/",
        include(
            [
                url(
                    r"^(?P<provider_id>[\w_-]+)/setup/$",
                    PipelineAdvancerView.as_view(),
                    name="sentry-extension-setup",
                ),
                url(r"^cloudflare/", include("sentry.integrations.cloudflare.urls")),
                url(r"^jira/", include("sentry.integrations.jira.urls")),
                url(r"^jira-server/", include("sentry.integrations.jira_server.urls")),
                url(r"^slack/", include("sentry.integrations.slack.urls")),
                url(r"^github/", include("sentry.integrations.github.urls")),
                url(r"^github-enterprise/", include("sentry.integrations.github_enterprise.urls")),
                url(r"^gitlab/", include("sentry.integrations.gitlab.urls")),
                url(r"^vsts/", include("sentry.integrations.vsts.urls")),
                url(r"^bitbucket/", include("sentry.integrations.bitbucket.urls")),
                url(r"^bitbucket-server/", include("sentry.integrations.bitbucket_server.urls")),
                url(r"^vercel/", include("sentry.integrations.vercel.urls")),
                url(r"^msteams/", include("sentry.integrations.msteams.urls")),
            ]
        ),
    ),
    url(r"^plugins/", include("sentry.plugins.base.urls")),
    # Generic API
    url(
        r"^share/(?:group|issue)/(?P<share_id>[\w_-]+)/$",
        GenericReactPageView.as_view(auth_required=False),
        name="sentry-group-shared",
    ),
    url(
        r"^join-request/(?P<organization_slug>[\w_-]+)/$",
        GenericReactPageView.as_view(auth_required=False),
        name="sentry-join-request",
    ),
    # Keep named URL for for things using reverse
    url(
        r"^(?P<organization_slug>[\w_-]+)/issues/(?P<short_id>[\w_-]+)/$",
        react_page_view,
        name="sentry-short-id",
    ),
    url(
        r"^(?P<organization_slug>[\w_-]+)/(?P<project_id>[\w_-]+)/issues/(?P<group_id>\d+)/$",
        react_page_view,
        name="sentry-group",
    ),
    url(
        r"^(?P<organization_slug>[\w_-]+)/(?P<project_slug>[\w_-]+)/issues/(?P<group_id>\d+)/events/(?P<event_id>[\w-]+)/$",
        react_page_view,
        name="sentry-group-event",
    ),
    url(
        r"^(?P<organization_slug>[\w_-]+)/(?P<project_id>[\w_-]+)/$",
        react_page_view,
        name="sentry-stream",
    ),
    url(
        r"^organizations/(?P<organization_slug>[\w_-]+)/alerts/(?P<incident_id>\d+)/$",
        react_page_view,
        name="sentry-metric-alert",
    ),
    url(
        r"^settings/(?P<organization_slug>[\w_-]+)/projects/(?P<project_slug>[\w_-]+)/alerts/metric-rules/(?P<alert_rule_id>\d+)/$",
        react_page_view,
        name="sentry-alert-rule",
    ),
    url(
        r"^(?P<organization_slug>[\w_-]+)/(?P<project_slug>[\w_-]+)/issues/(?P<group_id>\d+)/tags/(?P<key>[^\/]+)/export/$",
        GroupTagExportView.as_view(),
        name="sentry-group-tag-export",
    ),
    url(
        r"^(?P<organization_slug>[\w_-]+)/(?P<project_slug>[\w_-]+)/issues/(?P<group_id>\d+)/actions/(?P<slug>[\w_-]+)/",
        GroupPluginActionView.as_view(),
        name="sentry-group-plugin-action",
    ),
    url(
        r"^(?P<organization_slug>[\w_-]+)/(?P<project_slug>[\w_-]+)/events/(?P<client_event_id>[\w_-]+)/$",
        ProjectEventRedirect.as_view(),
        name="sentry-project-event-redirect",
    ),
    # Legacy
    # This triggers a false positive for the urls.W002 Django warning
    url(r"/$", react_page_view),
]
