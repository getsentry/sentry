"""
sentry.web.urls
~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

from django.conf import settings
from django.conf.urls import include, patterns, url
from django.http import HttpResponse
from django.views.generic import RedirectView

from sentry.web import api
from sentry.web.frontend import accounts, admin, generic
from sentry.web.frontend.accept_organization_invite import \
    AcceptOrganizationInviteView
from sentry.web.frontend.auth_login import AuthLoginView
from sentry.web.frontend.twofactor import TwoFactorAuthView, u2f_appid
from sentry.web.frontend.auth_logout import AuthLogoutView
from sentry.web.frontend.auth_organization_login import \
    AuthOrganizationLoginView
from sentry.web.frontend.auth_provider_login import AuthProviderLoginView
from sentry.web.frontend.auth_close import AuthCloseView
from sentry.web.frontend.error_page_embed import ErrorPageEmbedView
from sentry.web.frontend.group_event_json import GroupEventJsonView
from sentry.web.frontend.group_plugin_action import GroupPluginActionView
from sentry.web.frontend.group_tag_export import GroupTagExportView
from sentry.web.frontend.home import HomeView
from sentry.web.frontend.pipeline_advancer import PipelineAdvancerView
from sentry.web.frontend.mailgun_inbound_webhook import \
    MailgunInboundWebhookView
from sentry.web.frontend.oauth_authorize import OAuthAuthorizeView
from sentry.web.frontend.oauth_token import OAuthTokenView
from sentry.auth.providers.saml2 import SAML2AcceptACSView, SAML2SLSView, SAML2MetadataView
from sentry.web.frontend.organization_avatar import OrganizationAvatarPhotoView
from sentry.web.frontend.organization_auth_settings import \
    OrganizationAuthSettingsView
from sentry.web.frontend.organization_integration_setup import \
    OrganizationIntegrationSetupView
from sentry.web.frontend.out import OutView
from sentry.web.frontend.project_avatar import ProjectAvatarPhotoView
from sentry.web.frontend.react_page import GenericReactPageView, ReactPageView
from sentry.web.frontend.reactivate_account import ReactivateAccountView
from sentry.web.frontend.release_webhook import ReleaseWebhookView
from sentry.web.frontend.restore_organization import RestoreOrganizationView
from sentry.web.frontend.team_avatar import TeamAvatarPhotoView
from sentry.web.frontend.account_identity import AccountIdentityAssociateView
from sentry.web.frontend.sudo import SudoView
from sentry.web.frontend.unsubscribe_issue_notifications import \
    UnsubscribeIssueNotificationsView
from sentry.web.frontend.user_avatar import UserAvatarPhotoView
from sentry.web.frontend.setup_wizard import SetupWizardView
from sentry.web.frontend.vsts_extension_configuration import \
    VstsExtensionConfigurationView
from sentry.web.frontend.js_sdk_loader import JavaScriptSdkLoader


__all__ = ('urlpatterns', )


def init_all_applications():
    """
    Forces import of all applications to ensure code is registered.
    """
    from django.db.models import get_apps, get_models

    for app in get_apps():
        try:
            get_models(app)
        except Exception:
            continue


init_all_applications()

# Only create one instance of the ReactPageView since it's duplicated errywhere
generic_react_page_view = GenericReactPageView.as_view()
react_page_view = ReactPageView.as_view()

urlpatterns = patterns('')

if getattr(settings, 'DEBUG_VIEWS', settings.DEBUG):
    from sentry.web.debug_urls import urlpatterns as debug_urls
    urlpatterns += debug_urls

# Special favicon in debug mode
if settings.DEBUG:
    urlpatterns += patterns('', url(
        r'^_static/[^/]+/[^/]+/images/favicon\.ico$',
        generic.dev_favicon,
        name='sentry-dev-favicon'
    ))

urlpatterns += patterns(
    '',
    # Store endpoints first since they are the most active
    url(r'^api/store/$', api.StoreView.as_view(), name='sentry-api-store'),
    url(
        r'^api/(?P<project_id>[\w_-]+)/store/$',
        api.StoreView.as_view(),
        name='sentry-api-store'
    ),
    url(
        r'^api/(?P<project_id>[\w_-]+)/minidump/?$',
        api.MinidumpView.as_view(),
        name='sentry-api-minidump'
    ),
    url(
        r'^api/(?P<project_id>[\w_-]+)/unreal/(?P<sentry_key>\w+)/$',
        api.UnrealView.as_view(),
        name='sentry-api-unreal'
    ),
    url(
        r'^api/(?P<project_id>\d+)/security/$',
        api.SecurityReportView.as_view(),
        name='sentry-api-security-report'
    ),
    url(  # This URL to be deprecated
        r'^api/(?P<project_id>\d+)/csp-report/$',
        api.SecurityReportView.as_view(),
        name='sentry-api-csp-report'
    ),
    url(
        r'^api/(?P<project_id>[\w_-]+)/crossdomain\.xml$',
        api.crossdomain_xml,
        name='sentry-api-crossdomain-xml'
    ),
    url(r'^api/store/schema$', api.StoreSchemaView.as_view(), name='sentry-api-store-schema'),

    # The static version is either a 10 digit timestamp, a sha1, or md5 hash
    url(
        r'^_static/(?:(?P<version>\d{10}|[a-f0-9]{32,40})/)?(?P<module>[^/]+)/(?P<path>.*)$',
        generic.static_media,
        name='sentry-media'
    ),

    # Javascript SDK Loader

    url(
        r'^js-sdk-loader/(?P<public_key>[^/\.]+)(?:(?P<minified>\.min))?\.js$',
        JavaScriptSdkLoader.as_view(),
        name='sentry-js-sdk-loader'
    ),

    # API
    url(r'^api/0/', include('sentry.api.urls')),
    url(
        r'^api/hooks/mailgun/inbound/',
        MailgunInboundWebhookView.as_view(),
        name='sentry-mailgun-inbound-hook'
    ),
    url(
        r'^api/hooks/release/(?P<plugin_id>[^/]+)/(?P<project_id>[^/]+)/(?P<signature>[^/]+)/',
        ReleaseWebhookView.as_view(),
        name='sentry-release-hook'
    ),
    url(r'^api/embed/error-page/$', ErrorPageEmbedView.as_view(),
        name='sentry-error-page-embed'),

    # OAuth
    url(r'^oauth/authorize/$', OAuthAuthorizeView.as_view()),
    url(r'^oauth/token/$', OAuthTokenView.as_view()),

    # SAML
    url(r'^saml/acs/(?P<organization_slug>[^/]+)/$', SAML2AcceptACSView.as_view(),
        name='sentry-auth-organization-saml-acs'),
    url(r'^saml/sls/(?P<organization_slug>[^/]+)/$', SAML2SLSView.as_view(),
        name='sentry-auth-organization-saml-sls'),
    url(r'^saml/metadata/(?P<organization_slug>[^/]+)/$', SAML2MetadataView.as_view(),
        name='sentry-auth-organization-saml-metadata'),

    # Auth
    url(
        r'^auth/link/(?P<organization_slug>[^/]+)/$',
        AuthOrganizationLoginView.as_view(),
        name='sentry-auth-link-identity'
    ),
    url(r'^auth/login/$', AuthLoginView.as_view(), name='sentry-login'),
    url(
        r'^auth/login/(?P<organization_slug>[^/]+)/$',
        AuthOrganizationLoginView.as_view(),
        name='sentry-auth-organization'
    ),
    url(r'^auth/2fa/$', TwoFactorAuthView.as_view(), name='sentry-2fa-dialog'),
    url(r'^auth/2fa/u2fappid\.json$', u2f_appid, name='sentry-u2f-app-id'),
    url(r'^auth/sso/$', AuthProviderLoginView.as_view(), name='sentry-auth-sso'),
    url(r'^auth/logout/$', AuthLogoutView.as_view(), name='sentry-logout'),
    url(r'^auth/reactivate/$', ReactivateAccountView.as_view(),
        name='sentry-reactivate-account'),
    url(r'^auth/register/$', AuthLoginView.as_view(), name='sentry-register'),
    url(r'^auth/close/$', AuthCloseView.as_view(), name='sentry-auth-close'),

    # Account
    url(r'^login-redirect/$', accounts.login_redirect,
        name='sentry-login-redirect'),
    url(r'^account/sudo/$', SudoView.as_view(), name='sentry-sudo'),
    url(
        r'^account/confirm-email/$',
        accounts.start_confirm_email,
        name='sentry-account-confirm-email-send'
    ),
    url(r'^account/authorizations/$',
        RedirectView.as_view(
            pattern_name="sentry-account-settings-authorizations",
            permanent=False),
        ),
    url(
        r'^account/confirm-email/(?P<user_id>[\d]+)/(?P<hash>[0-9a-zA-Z]+)/$',
        accounts.confirm_email,
        name='sentry-account-confirm-email'
    ),
    url(r'^account/recover/$', accounts.recover, name='sentry-account-recover'),
    url(
        r'^account/recover/confirm/(?P<user_id>[\d]+)/(?P<hash>[0-9a-zA-Z]+)/$',
        accounts.recover_confirm,
        name='sentry-account-recover-confirm'
    ),
    url(
        r'^account/password/confirm/(?P<user_id>[\d]+)/(?P<hash>[0-9a-zA-Z]+)/$',
        accounts.set_password_confirm,
        name='sentry-account-set-password-confirm'
    ),
    url(r'^account/settings/$',
        RedirectView.as_view(pattern_name="sentry-account-settings", permanent=False),
        ),
    url(
        r'^account/settings/2fa/$',
        RedirectView.as_view(pattern_name="sentry-account-settings-security", permanent=False),
    ),
    url(
        r'^account/settings/avatar/$',
        RedirectView.as_view(pattern_name="sentry-account-settings-avatar", permanent=False),
    ),
    url(
        r'^account/settings/appearance/$',
        RedirectView.as_view(pattern_name="sentry-account-settings-appearance", permanent=False),
    ),
    url(
        r'^account/settings/identities/$',
        RedirectView.as_view(pattern_name="sentry-account-settings-identities", permanent=False),
    ),
    url(
        r'^account/settings/subscriptions/$',
        RedirectView.as_view(pattern_name="sentry-account-settings-subscriptions", permanent=False),
    ),
    url(
        r'^account/settings/identities/(?P<identity_id>[^\/]+)/disconnect/$',
        accounts.disconnect_identity,
        name='sentry-account-disconnect-identity'
    ),
    url(
        r'^account/settings/identities/associate/(?P<organization_slug>[^\/]+)/(?P<provider_key>[^\/]+)/(?P<external_id>[^\/]+)/$',
        AccountIdentityAssociateView.as_view(),
        name='sentry-account-associate-identity'
    ),
    url(
        r'^account/settings/security/',
        RedirectView.as_view(pattern_name="sentry-account-settings-security", permanent=False),
    ),
    url(r'^account/settings/emails/$',
        RedirectView.as_view(pattern_name="sentry-account-settings-emails", permanent=False),
        ),

    # Project Wizard
    url(
        r'^account/settings/wizard/(?P<wizard_hash>[^\/]+)/$',
        SetupWizardView.as_view(),
        name='sentry-project-wizard-fetch'
    ),

    # compatibility
    url(
        r'^account/settings/notifications/unsubscribe/(?P<project_id>\d+)/$',
        accounts.email_unsubscribe_project
    ),
    url(
        r'^account/settings/notifications/',
        RedirectView.as_view(pattern_name="sentry-account-settings-notifications", permanent=False),
    ),
    url(
        r'^account/notifications/unsubscribe/(?P<project_id>\d+)/$',
        accounts.email_unsubscribe_project,
        name='sentry-account-email-unsubscribe-project'
    ),
    url(
        r'^account/notifications/unsubscribe/issue/(?P<issue_id>\d+)/$',
        UnsubscribeIssueNotificationsView.as_view(),
        name='sentry-account-email-unsubscribe-issue'
    ),
    url(r'^account/remove/$',
        RedirectView.as_view(pattern_name="sentry-remove-account", permanent=False),
        ),
    url(r'^account/settings/social/', include('social_auth.urls')),
    url(r'^account/', generic_react_page_view),
    url(r'^onboarding/', generic_react_page_view),

    # Admin
    url(r'^manage/status/environment/$',
        admin.status_env, name='sentry-admin-status'),
    url(r'^manage/status/packages/$', admin.status_packages,
        name='sentry-admin-packages-status'),
    url(r'^manage/status/mail/$', admin.status_mail,
        name='sentry-admin-mail-status'),
    url(r'^manage/status/warnings/$', admin.status_warnings,
        name='sentry-admin-warnings-status'),

    # Admin - Users
    url(r'^manage/users/new/$', admin.create_new_user,
        name='sentry-admin-new-user'),
    url(r'^manage/users/(?P<user_id>\d+)/$',
        admin.edit_user, name='sentry-admin-edit-user'),
    url(
        r'^manage/users/(?P<user_id>\d+)/remove/$',
        admin.remove_user,
        name='sentry-admin-remove-user'
    ),

    # Admin - Plugins
    url(
        r'^manage/plugins/(?P<slug>[\w_-]+)/$',
        admin.configure_plugin,
        name='sentry-admin-configure-plugin'
    ),
    url(r'^manage/', react_page_view, name='sentry-admin-overview'),

    # Legacy Redirects
    url(
        r'^docs/?$',
        RedirectView.as_view(
            url='https://docs.sentry.io/hosted/', permanent=False),
        name='sentry-docs-redirect'
    ),
    url(
        r'^docs/api/?$',
        RedirectView.as_view(
            url='https://docs.sentry.io/hosted/api/', permanent=False),
        name='sentry-api-docs-redirect'
    ),
    url(r'^api/$',
        RedirectView.as_view(pattern_name="sentry-api", permanent=False),
        ),
    url(r'^api/applications/$',
        RedirectView.as_view(pattern_name="sentry-api-applications", permanent=False)),
    url(r'^api/new-token/$',
        RedirectView.as_view(pattern_name="sentry-api-new-auth-token", permanent=False)),
    url(r'^api/[^0]+/',
        RedirectView.as_view(pattern_name="sentry-api-details", permanent=False),
        ),
    url(r'^out/$', OutView.as_view()),

    url(r'^accept-transfer/$', react_page_view, name='sentry-accept-project-transfer'),
    # User settings use generic_react_page_view, while any view
    # acting on behalf of an organization should use react_page_view
    url(r'^settings/account/$', generic_react_page_view, name="sentry-account-settings"),
    url(r'^settings/account/$', generic_react_page_view, name="sentry-account-settings-appearance"),
    url(r'^settings/account/authorizations/$', generic_react_page_view,
        name="sentry-account-settings-authorizations"),
    url(r'^settings/account/security/', generic_react_page_view,
        name='sentry-account-settings-security'),
    url(r'^settings/account/avatar/$', generic_react_page_view, name='sentry-account-settings-avatar'),
    url(r'^settings/account/identities/$', generic_react_page_view,
        name='sentry-account-settings-identities'),
    url(r'^settings/account/subscriptions/$', generic_react_page_view,
        name='sentry-account-settings-subscriptions'),
    url(r'^settings/account/notifications/', generic_react_page_view,
        name='sentry-account-settings-notifications'),
    url(r'^settings/account/emails/$', generic_react_page_view, name='sentry-account-settings-emails'),
    url(r'^settings/account/api/$', generic_react_page_view, name='sentry-api'),
    url(r'^settings/account/api/applications/$',
        generic_react_page_view, name='sentry-api-applications'),
    url(r'^settings/account/api/auth-tokens/new-token/$',
        generic_react_page_view, name='sentry-api-new-auth-token'),
    url(r'^settings/account/api/[^0]+/$', generic_react_page_view, name='sentry-api-details'),
    url(r'^settings/account/close-account/$', generic_react_page_view, name='sentry-remove-account'),
    url(r'^settings/account/', generic_react_page_view),

    url(r'^settings/', react_page_view),
    url(
        r'^settings/(?P<organization_slug>[\w_-]+)/members/$',
        react_page_view,
        name='sentry-organization-members'
    ),
    url(
        r'^settings/(?P<organization_slug>[\w_-]+)/members/new/$',
        react_page_view,
        name='sentry-create-organization-member'
    ),
    url(
        r'^settings/(?P<organization_slug>[\w_-]+)/members/(?P<member_id>\d+)/$',
        react_page_view,
        name='sentry-organization-member-settings'
    ),
    url(r'^extensions/external-install/(?P<provider_id>\w+)/(?P<installation_id>\w+)/$',
        react_page_view, name='integration-installation'),

    # Organizations
    url(r'^(?P<organization_slug>[\w_-]+)/$',
        react_page_view, name='sentry-organization-home'),
    url(r'^organizations/new/$', generic_react_page_view),
    url(
        r'^organizations/(?P<organization_slug>[\w_-]+)/api-keys/$',
        react_page_view,
        name='sentry-organization-api-keys'
    ),
    url(
        r'^organizations/(?P<organization_slug>[\w_-]+)/api-keys/(?P<key_id>[\w_-]+)/$',
        react_page_view,
        name='sentry-organization-api-key-settings'
    ),
    url(
        r'^organizations/(?P<organization_slug>[\w_-]+)/auth/$',
        react_page_view,
        name='sentry-organization-auth-settings'
    ),
    url(
        r'^organizations/(?P<organization_slug>[\w_-]+)/auth/configure/$',
        OrganizationAuthSettingsView.as_view(),
        name='sentry-organization-auth-provider-settings'
    ),
    url(
        r'^organizations/(?P<organization_slug>[\w_-]+)/integrations/(?P<provider_id>[\w_-]+)/setup/$',
        OrganizationIntegrationSetupView.as_view(),
        name='sentry-organization-integrations-setup'
    ),
    url(
        r'^organizations/(?P<organization_slug>[\w_-]+)/members/$',
        RedirectView.as_view(pattern_name="sentry-organization-members", permanent=False),
        name='sentry-organization-members-old'
    ),
    url(
        r'^organizations/(?P<organization_slug>[\w_-]+)/members/new/$',
        RedirectView.as_view(pattern_name="sentry-create-organization-member", permanent=False),
        name='sentry-create-organization-member-old'
    ),
    url(
        r'^organizations/(?P<organization_slug>[\w_-]+)/members/(?P<member_id>\d+)/$',
        RedirectView.as_view(pattern_name="sentry-organization-member-settings", permanent=False),
        name='sentry-organization-member-settings-old'
    ),
    url(
        r'^organizations/(?P<organization_slug>[\w_-]+)/stats/$',
        react_page_view,
        name='sentry-organization-stats'
    ),
    url(
        r'^organizations/(?P<organization_slug>[\w_-]+)/restore/$',
        RestoreOrganizationView.as_view(),
        name='sentry-restore-organization'
    ),
    url(
        r'^accept/(?P<member_id>\d+)/(?P<token>\w+)/$',
        AcceptOrganizationInviteView.as_view(),
        name='sentry-accept-invite'
    ),

    # need to catch settings and force it to react
    url(
        r'^organizations/(?P<organization_slug>[\w_-]+)/settings/', react_page_view),

    # Settings - Projects
    url(
        r'^(?P<organization_slug>[\w_-]+)/(?P<project_slug>[\w_-]+)/settings/$',
        react_page_view,
        name='sentry-manage-project'
    ),
    url(
        r'^avatar/(?P<avatar_id>[^\/]+)/$',
        UserAvatarPhotoView.as_view(),
        name='sentry-user-avatar-url'
    ),
    url(
        r'^organization-avatar/(?P<avatar_id>[^\/]+)/$',
        OrganizationAvatarPhotoView.as_view(),
        name='sentry-organization-avatar-url'
    ),
    url(
        r'^project-avatar/(?P<avatar_id>[^\/]+)/$',
        ProjectAvatarPhotoView.as_view(),
        name='sentry-project-avatar-url'
    ),
    url(
        r'^team-avatar/(?P<avatar_id>[^\/]+)/$',
        TeamAvatarPhotoView.as_view(),
        name='sentry-team-avatar-url'
    ),

    # VSTS Marketplace extension install flow
    url(
        r'^extensions/vsts/configure/$',
        VstsExtensionConfigurationView.as_view(),
        name='vsts-extension-configuration',
    ),

    # Generic
    url(r'^$', HomeView.as_view(), name='sentry'),
    url(r'^robots\.txt$', api.robots_txt, name='sentry-api-robots-txt'),



    # Force a 404 of favicon.ico.
    # This url is commonly requested by browsers, and without
    # blocking this, it was treated as a 200 OK for a react page view.
    # A side effect of this is it may cause a bad redirect when logging in
    # since this gets stored in session as the last viewed page.
    # See: https://github.com/getsentry/sentry/issues/2195
    url(r'favicon\.ico$', lambda r: HttpResponse(status=404)),

    # crossdomain.xml
    url(r'^crossdomain\.xml$', lambda r: HttpResponse(status=404)),

    # plugins
    # XXX(dcramer): preferably we'd be able to use 'integrations' as the URL
    # prefix here, but unfortunately sentry.io has that mapped to marketing
    # assets for the time being
    url(
        r'^extensions/(?P<provider_id>[\w_-]+)/setup/$',
        PipelineAdvancerView.as_view(),
        name='sentry-extension-setup'
    ),
    url(r'^extensions/cloudflare/', include('sentry.integrations.cloudflare.urls')),
    url(r'^extensions/jira/', include('sentry.integrations.jira.urls')),
    url(r'^extensions/jira-server/', include('sentry.integrations.jira_server.urls')),
    url(r'^extensions/slack/', include('sentry.integrations.slack.urls')),
    url(r'^extensions/github/', include('sentry.integrations.github.urls')),
    url(r'^extensions/github-enterprise/', include('sentry.integrations.github_enterprise.urls')),
    url(r'^extensions/gitlab/', include('sentry.integrations.gitlab.urls')),
    url(r'^extensions/vsts/', include('sentry.integrations.vsts.urls')),
    url(r'^extensions/bitbucket/', include('sentry.integrations.bitbucket.urls')),

    url(r'^plugins/', include('sentry.plugins.base.urls')),

    # Generic API
    url(
        r'^share/(?:group|issue)/(?P<share_id>[\w_-]+)/$',
        GenericReactPageView.as_view(auth_required=False),
        name='sentry-group-shared'
    ),

    # Keep named URL for for things using reverse
    url(
        r'^(?P<organization_slug>[\w_-]+)/issues/(?P<short_id>[\w_-]+)/$',
        react_page_view,
        name='sentry-short-id'
    ),
    url(
        r'^(?P<organization_slug>[\w_-]+)/(?P<project_id>[\w_-]+)/issues/(?P<group_id>\d+)/$',
        react_page_view,
        name='sentry-group'
    ),
    url(
        r'^(?P<organization_slug>[\w_-]+)/(?P<project_id>[\w_-]+)/$',
        react_page_view,
        name='sentry-stream'
    ),
    url(
        r'^(?P<organization_slug>[\w_-]+)/(?P<project_slug>[\w_-]+)/(?:group|issues)/(?P<group_id>\d+)/events/(?P<event_id_or_latest>(\d+|latest))/json/$',
        GroupEventJsonView.as_view(),
        name='sentry-group-event-json'
    ),
    url(
        r'^(?P<organization_slug>[\w_-]+)/(?P<project_slug>[\w_-]+)/issues/(?P<group_id>\d+)/tags/(?P<key>[^\/]+)/export/$',
        GroupTagExportView.as_view(),
        name='sentry-group-tag-export'
    ),
    url(
        r'^(?P<organization_slug>[\w_-]+)/(?P<project_slug>[\w_-]+)/issues/(?P<group_id>\d+)/actions/(?P<slug>[\w_-]+)/',
        GroupPluginActionView.as_view(),
        name='sentry-group-plugin-action'
    ),

    # Legacy
    url(r'/$', react_page_view),
)
