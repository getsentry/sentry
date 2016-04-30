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
from sentry.web.frontend.admin_queue import AdminQueueView
from sentry.web.frontend.auth_login import AuthLoginView
from sentry.web.frontend.auth_logout import AuthLogoutView
from sentry.web.frontend.auth_organization_login import \
    AuthOrganizationLoginView
from sentry.web.frontend.auth_provider_login import AuthProviderLoginView
from sentry.web.frontend.create_organization import CreateOrganizationView
from sentry.web.frontend.create_organization_member import \
    CreateOrganizationMemberView
from sentry.web.frontend.create_project import CreateProjectView
from sentry.web.frontend.create_project_key import CreateProjectKeyView
from sentry.web.frontend.create_team import CreateTeamView
from sentry.web.frontend.disable_project_key import DisableProjectKeyView
from sentry.web.frontend.edit_project_key import EditProjectKeyView
from sentry.web.frontend.enable_project_key import EnableProjectKeyView
from sentry.web.frontend.error_page_embed import ErrorPageEmbedView
from sentry.web.frontend.group_event_json import GroupEventJsonView
from sentry.web.frontend.group_plugin_action import GroupPluginActionView
from sentry.web.frontend.group_tag_export import GroupTagExportView
from sentry.web.frontend.home import HomeView
from sentry.web.frontend.mailgun_inbound_webhook import \
    MailgunInboundWebhookView
from sentry.web.frontend.organization_api_key_settings import \
    OrganizationApiKeySettingsView
from sentry.web.frontend.organization_api_keys import OrganizationApiKeysView
from sentry.web.frontend.organization_auth_settings import \
    OrganizationAuthSettingsView
from sentry.web.frontend.organization_member_settings import \
    OrganizationMemberSettingsView
from sentry.web.frontend.organization_members import OrganizationMembersView
from sentry.web.frontend.organization_settings import OrganizationSettingsView
from sentry.web.frontend.project_issue_tracking import ProjectIssueTrackingView
from sentry.web.frontend.project_keys import ProjectKeysView
from sentry.web.frontend.project_notifications import ProjectNotificationsView
from sentry.web.frontend.project_plugin_configure import \
    ProjectPluginConfigureView
from sentry.web.frontend.project_plugin_disable import ProjectPluginDisableView
from sentry.web.frontend.project_plugin_enable import ProjectPluginEnableView
from sentry.web.frontend.project_plugin_reset import ProjectPluginResetView
from sentry.web.frontend.project_plugins import ProjectPluginsView
from sentry.web.frontend.project_quotas import ProjectQuotasView
from sentry.web.frontend.project_release_tracking import \
    ProjectReleaseTrackingView
from sentry.web.frontend.project_rule_edit import ProjectRuleEditView
from sentry.web.frontend.project_rule_remove import ProjectRuleRemoveView
from sentry.web.frontend.project_rules import ProjectRulesView
from sentry.web.frontend.project_settings import ProjectSettingsView
from sentry.web.frontend.project_tags import ProjectTagsView
from sentry.web.frontend.react_page import GenericReactPageView, ReactPageView
from sentry.web.frontend.reactivate_account import ReactivateAccountView
from sentry.web.frontend.release_webhook import ReleaseWebhookView
from sentry.web.frontend.remove_account import RemoveAccountView
from sentry.web.frontend.remove_organization import RemoveOrganizationView
from sentry.web.frontend.remove_project import RemoveProjectView
from sentry.web.frontend.remove_project_key import RemoveProjectKeyView
from sentry.web.frontend.remove_team import RemoveTeamView
from sentry.web.frontend.replay_event import ReplayEventView

__all__ = ('urlpatterns',)


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
react_page_view = ReactPageView.as_view()

urlpatterns = patterns('')

if settings.DEBUG:
    import sentry.web.frontend.debug.mail
    from sentry.web.frontend.debug.debug_trigger_error import DebugTriggerErrorView
    from sentry.web.frontend.debug.debug_error_embed import DebugErrorPageEmbedView
    from sentry.web.frontend.debug.debug_new_release_email import DebugNewReleaseEmailView
    from sentry.web.frontend.debug import debug_auth_views

    urlpatterns += patterns(
        '',
        url(r'^debug/mail/new-event/$',
            sentry.web.frontend.debug.mail.new_event),
        url(r'^debug/mail/new-note/$',
            sentry.web.frontend.debug.mail.new_note),
        url(r'^debug/mail/new-release/$',
            DebugNewReleaseEmailView.as_view()),
        url(r'^debug/mail/assigned/$',
            sentry.web.frontend.debug.mail.assigned),
        url(r'^debug/mail/digest/$',
            sentry.web.frontend.debug.mail.digest),
        url(r'^debug/mail/request-access/$',
            sentry.web.frontend.debug.mail.request_access),
        url(r'^debug/mail/access-approved/$',
            sentry.web.frontend.debug.mail.access_approved),
        url(r'^debug/mail/invitation/$',
            sentry.web.frontend.debug.mail.invitation),
        url(r'^debug/embed/error-page/$',
            DebugErrorPageEmbedView.as_view()),
        url(r'^debug/trigger-error/$',
            DebugTriggerErrorView.as_view()),
        url(r'^debug/auth-confirm-identity/$',
            debug_auth_views.DebugAuthConfirmIdentity.as_view()),
        url(r'^debug/auth-confirm-link/$',
            debug_auth_views.DebugAuthConfirmLink.as_view()),
    )

urlpatterns += patterns(
    '',
    # Store endpoints first since they are the most active
    url(r'^api/store/$', api.StoreView.as_view(),
        name='sentry-api-store'),
    url(r'^api/(?P<project_id>[\w_-]+)/store/$', api.StoreView.as_view(),
        name='sentry-api-store'),
    url(r'^api/(?P<project_id>\d+)/csp-report/$', api.CspReportView.as_view(),
        name='sentry-api-csp-report'),

    # The static version is either a 10 digit timestamp, a sha1, or md5 hash
    url(r'^_static/(?:(?P<version>\d{10}|[a-f0-9]{32,40})/)?(?P<module>[^/]+)/(?P<path>.*)$', generic.static_media,
        name='sentry-media'),

    # API
    url(r'^api/0/', include('sentry.api.urls')),
    url(r'^api/hooks/mailgun/inbound/', MailgunInboundWebhookView.as_view(),
        name='sentry-mailgun-inbound-hook'),
    url(r'^api/hooks/release/(?P<plugin_id>[^/]+)/(?P<project_id>[^/]+)/(?P<signature>[^/]+)/', ReleaseWebhookView.as_view(),
        name='sentry-release-hook'),
    url(r'^api/embed/error-page/$', ErrorPageEmbedView.as_view(),
        name='sentry-error-page-embed'),

    # Auth
    url(r'^auth/link/(?P<organization_slug>[^/]+)/$', AuthOrganizationLoginView.as_view(),
        name='sentry-auth-link-identity'),
    url(r'^auth/login/$', AuthLoginView.as_view(),
        name='sentry-login'),
    url(r'^auth/login/(?P<organization_slug>[^/]+)/$', AuthOrganizationLoginView.as_view(),
        name='sentry-auth-organization'),
    url(r'^auth/sso/$', AuthProviderLoginView.as_view(),
        name='sentry-auth-sso'),
    url(r'^auth/logout/$', AuthLogoutView.as_view(),
        name='sentry-logout'),
    url(r'^auth/reactivate/$', ReactivateAccountView.as_view(),
        name='sentry-reactivate-account'),

    # Account
    url(r'^login-redirect/$', accounts.login_redirect,
        name='sentry-login-redirect'),
    url(r'^register/$', AuthLoginView.as_view(),
        name='sentry-register'),
    url(r'^account/sudo/$', 'sudo.views.sudo',
        {'template_name': 'sentry/account/sudo.html'},
        name='sentry-sudo'),
    url(r'^account/recover/$', accounts.recover,
        name='sentry-account-recover'),
    url(r'^account/recover/confirm/(?P<user_id>[\d]+)/(?P<hash>[0-9a-zA-Z]+)/$', accounts.recover_confirm,
        name='sentry-account-recover-confirm'),
    url(r'^account/settings/$', accounts.settings,
        name='sentry-account-settings'),
    url(r'^account/settings/appearance/$', accounts.appearance_settings,
        name='sentry-account-settings-appearance'),
    url(r'^account/settings/identities/$', accounts.list_identities,
        name='sentry-account-settings-identities'),
    url(r'^account/settings/notifications/$', accounts.notification_settings,
        name='sentry-account-settings-notifications'),
    url(r'^account/remove/$', RemoveAccountView.as_view(),
        name='sentry-remove-account'),
    url(r'^account/settings/social/', include('social_auth.urls')),

    # Admin
    url(r'^manage/queue/$', AdminQueueView.as_view(),
        name='sentry-admin-queue'),
    url(r'^manage/status/environment/$', admin.status_env,
        name='sentry-admin-status'),
    url(r'^manage/status/packages/$', admin.status_packages,
        name='sentry-admin-packages-status'),
    url(r'^manage/status/mail/$', admin.status_mail,
        name='sentry-admin-mail-status'),
    url(r'^manage/status/warnings/$', admin.status_warnings,
        name='sentry-admin-warnings-status'),

    # Admin - Teams
    url(r'^manage/teams/$', admin.manage_teams,
        name='sentry-admin-teams'),

    # Admin - Projects
    url(r'^manage/projects/$', admin.manage_projects,
        name='sentry-admin-projects'),

    # Admin - Users
    url(r'^manage/users/$', admin.manage_users,
        name='sentry-admin-users'),
    url(r'^manage/users/new/$', admin.create_new_user,
        name='sentry-admin-new-user'),
    url(r'^manage/users/(?P<user_id>\d+)/$', admin.edit_user,
        name='sentry-admin-edit-user'),
    url(r'^manage/users/(?P<user_id>\d+)/remove/$', admin.remove_user,
        name='sentry-admin-remove-user'),
    url(r'^manage/users/(?P<user_id>\d+)/projects/$', admin.list_user_projects,
        name='sentry-admin-list-user-projects'),

    # Admin - Plugins
    url(r'^manage/plugins/(?P<slug>[\w_-]+)/$', admin.configure_plugin,
        name='sentry-admin-configure-plugin'),


    url(r'^manage/', react_page_view,
        name='sentry-admin-overview'),

    # Legacy Redirects
    url(r'^docs/?$',
        RedirectView.as_view(url='https://docs.getsentry.com/hosted/', permanent=False),
        name='sentry-docs-redirect'),
    url(r'^api/?$',
        RedirectView.as_view(url='https://docs.getsentry.com/hosted/api/', permanent=False),
        name='sentry-api-docs-redirect'),
    url(r'^docs/api/?$',
        RedirectView.as_view(url='https://docs.getsentry.com/hosted/api/', permanent=False),
        name='sentry-api-docs-redirect'),

    # Organizations
    url(r'^(?P<organization_slug>[\w_-]+)/$', react_page_view,
        name='sentry-organization-home'),
    url(r'^organizations/new/$', CreateOrganizationView.as_view(),
        name='sentry-create-organization'),
    url(r'^organizations/(?P<organization_slug>[\w_-]+)/api-keys/$', OrganizationApiKeysView.as_view(),
        name='sentry-organization-api-keys'),
    url(r'^organizations/(?P<organization_slug>[\w_-]+)/api-keys/(?P<key_id>[\w_-]+)/$', OrganizationApiKeySettingsView.as_view(),
        name='sentry-organization-api-key-settings'),
    url(r'^organizations/(?P<organization_slug>[\w_-]+)/auth/$', OrganizationAuthSettingsView.as_view(),
        name='sentry-organization-auth-settings'),
    url(r'^organizations/(?P<organization_slug>[\w_-]+)/members/$', OrganizationMembersView.as_view(),
        name='sentry-organization-members'),
    url(r'^organizations/(?P<organization_slug>[\w_-]+)/members/new/$', CreateOrganizationMemberView.as_view(),
        name='sentry-create-organization-member'),
    url(r'^organizations/(?P<organization_slug>[\w_-]+)/members/(?P<member_id>\d+)/$', OrganizationMemberSettingsView.as_view(),
        name='sentry-organization-member-settings'),
    url(r'^organizations/(?P<organization_slug>[\w_-]+)/stats/$', react_page_view,
        name='sentry-organization-stats'),
    url(r'^organizations/(?P<organization_slug>[\w_-]+)/settings/$', OrganizationSettingsView.as_view(),
        name='sentry-organization-settings'),
    url(r'^organizations/(?P<organization_slug>[\w_-]+)/teams/(?P<team_slug>[\w_-]+)/remove/$', RemoveTeamView.as_view(),
        name='sentry-remove-team'),
    url(r'^organizations/(?P<organization_slug>[\w_-]+)/teams/new/$', CreateTeamView.as_view(),
        name='sentry-create-team'),
    url(r'^organizations/(?P<organization_slug>[\w_-]+)/projects/new/$', CreateProjectView.as_view(),
        name='sentry-create-project'),
    url(r'^organizations/(?P<organization_slug>[\w_-]+)/remove/$', RemoveOrganizationView.as_view(),
        name='sentry-remove-organization'),
    url(r'^accept/(?P<member_id>\d+)/(?P<token>\w+)/$', AcceptOrganizationInviteView.as_view(),
        name='sentry-accept-invite'),

    # Settings - Projects
    url(r'^(?P<organization_slug>[\w_-]+)/(?P<project_slug>[\w_-]+)/settings/$',
        ProjectSettingsView.as_view(),
        name='sentry-manage-project'),
    url(r'^(?P<organization_slug>[\w_-]+)/(?P<project_slug>[\w_-]+)/settings/issue-tracking/$',
        ProjectIssueTrackingView.as_view(),
        name='sentry-project-issue-tracking'),
    url(r'^(?P<organization_slug>[\w_-]+)/(?P<project_slug>[\w_-]+)/settings/release-tracking/$',
        ProjectReleaseTrackingView.as_view(),
        name='sentry-project-release-tracking'),
    url(r'^(?P<organization_slug>[\w_-]+)/(?P<project_slug>[\w_-]+)/settings/keys/$',
        ProjectKeysView.as_view(),
        name='sentry-manage-project-keys'),
    url(r'^(?P<organization_slug>[\w_-]+)/(?P<project_slug>[\w_-]+)/settings/keys/new/$',
        CreateProjectKeyView.as_view(),
        name='sentry-new-project-key'),
    url(r'^(?P<organization_slug>[\w_-]+)/(?P<project_slug>[\w_-]+)/settings/keys/(?P<key_id>\d+)/edit/$',
        EditProjectKeyView.as_view(),
        name='sentry-edit-project-key'),
    url(r'^(?P<organization_slug>[\w_-]+)/(?P<project_slug>[\w_-]+)/settings/keys/(?P<key_id>\d+)/remove/$',
        RemoveProjectKeyView.as_view(),
        name='sentry-remove-project-key'),
    url(r'^(?P<organization_slug>[\w_-]+)/(?P<project_slug>[\w_-]+)/settings/keys/(?P<key_id>\d+)/disable/$',
        DisableProjectKeyView.as_view(),
        name='sentry-disable-project-key'),
    url(r'^(?P<organization_slug>[\w_-]+)/(?P<project_slug>[\w_-]+)/settings/keys/(?P<key_id>\d+)/enable/$',
        EnableProjectKeyView.as_view(),
        name='sentry-enable-project-key'),

    url(r'^(?P<organization_slug>[\w_-]+)/(?P<project_slug>[\w_-]+)/settings/plugins/$',
        ProjectPluginsView.as_view(),
        name='sentry-manage-project-plugins'),
    url(r'^(?P<organization_slug>[\w_-]+)/(?P<project_slug>[\w_-]+)/settings/plugins/(?P<slug>[\w_-]+)/$',
        ProjectPluginConfigureView.as_view(),
        name='sentry-configure-project-plugin'),
    url(r'^(?P<organization_slug>[\w_-]+)/(?P<project_slug>[\w_-]+)/settings/plugins/(?P<slug>[\w_-]+)/reset/$',
        ProjectPluginResetView.as_view(),
        name='sentry-reset-project-plugin'),
    url(r'^(?P<organization_slug>[\w_-]+)/(?P<project_slug>[\w_-]+)/settings/plugins/(?P<slug>[\w_-]+)/disable/$',
        ProjectPluginDisableView.as_view(),
        name='sentry-disable-project-plugin'),
    url(r'^(?P<organization_slug>[\w_-]+)/(?P<project_slug>[\w_-]+)/settings/plugins/(?P<slug>[\w_-]+)/enable/$',
        ProjectPluginEnableView.as_view(),
        name='sentry-enable-project-plugin'),

    url(r'^(?P<organization_slug>[\w_-]+)/(?P<project_slug>[\w_-]+)/settings/remove/$',
        RemoveProjectView.as_view(),
        name='sentry-remove-project'),

    url(r'^(?P<organization_slug>[\w_-]+)/(?P<project_slug>[\w_-]+)/settings/tags/$',
        ProjectTagsView.as_view(),
        name='sentry-manage-project-tags'),

    url(r'^(?P<organization_slug>[\w_-]+)/(?P<project_slug>[\w_-]+)/settings/quotas/$',
        ProjectQuotasView.as_view(),
        name='sentry-manage-project-quotas'),

    url(r'^(?P<organization_slug>[\w_-]+)/(?P<project_slug>[\w_-]+)/settings/notifications/$',
        ProjectNotificationsView.as_view(),
        name='sentry-project-notifications'),

    url(r'^(?P<organization_slug>[\w_-]+)/(?P<project_slug>[\w_-]+)/settings/rules/$',
        ProjectRulesView.as_view(),
        name='sentry-project-rules'),
    url(r'^(?P<organization_slug>[\w_-]+)/(?P<project_slug>[\w_-]+)/settings/rules/(?P<rule_id>\d+)/edit/$',
        ProjectRuleEditView.as_view(),
        name='sentry-edit-project-rule'),
    url(r'^(?P<organization_slug>[\w_-]+)/(?P<project_slug>[\w_-]+)/settings/rules/(?P<rule_id>\d+)/remove/$',
        ProjectRuleRemoveView.as_view(),
        name='sentry-remove-project-rule'),
    url(r'^(?P<organization_slug>[\w_-]+)/(?P<project_slug>[\w_-]+)/settings/rules/new/$',
        ProjectRuleEditView.as_view(),
        name='sentry-new-project-rule'),

    # Generic
    url(r'^$', HomeView.as_view(),
        name='sentry'),

    url(r'^robots\.txt$', api.robots_txt,
        name='sentry-api-robots-txt'),

    # Force a 404 of favicon.ico.
    # This url is commonly requested by browsers, and without
    # blocking this, it was treated as a 200 OK for a react page view.
    # A side effect of this is it may cause a bad redirect when logging in
    # since this gets stored in session as the last viewed page.
    # See: https://github.com/getsentry/sentry/issues/2195
    url(r'favicon\.ico$', lambda r: HttpResponse(status=404)),

    # crossdomain.xml
    url(r'^crossdomain\.xml$', api.crossdomain_xml_index,
        name='sentry-api-crossdomain-xml-index'),
    url(r'^api/(?P<project_id>[\w_-]+)/crossdomain\.xml$', api.crossdomain_xml,
        name='sentry-api-crossdomain-xml'),

    # plugins
    url(r'^plugins/', include('sentry.plugins.base.urls')),

    # Generic API
    url(r'^share/(?:group|issue)/(?P<share_id>[\w_-]+)/$', GenericReactPageView.as_view(auth_required=False),
        name='sentry-group-shared'),

    # Keep named URL for for things using reverse
    url(r'^(?P<organization_slug>[\w_-]+)/issues/(?P<short_id>[\w_-]+)/$', react_page_view,
        name='sentry-short-id'),
    url(r'^(?P<organization_slug>[\w_-]+)/(?P<project_id>[\w_-]+)/issues/(?P<group_id>\d+)/$', react_page_view,
        name='sentry-group'),
    url(r'^(?P<organization_slug>[\w_-]+)/(?P<project_id>[\w_-]+)/$', react_page_view,
        name='sentry-stream'),

    url(r'^(?P<organization_slug>[\w_-]+)/(?P<project_slug>[\w_-]+)/(?:group|issues)/(?P<group_id>\d+)/events/(?P<event_id>\d+)/replay/$', ReplayEventView.as_view(),
        name='sentry-replay'),
    url(r'^(?P<organization_slug>[\w_-]+)/(?P<project_slug>[\w_-]+)/(?:group|issues)/(?P<group_id>\d+)/events/(?P<event_id_or_latest>(\d+|latest))/json/$', GroupEventJsonView.as_view(),
        name='sentry-group-event-json'),
    url(r'^(?P<organization_slug>[\w_-]+)/(?P<project_slug>[\w_-]+)/issues/(?P<group_id>\d+)/tags/(?P<key>[^\/]+)/export/$', GroupTagExportView.as_view(),
        name='sentry-group-tag-export'),
    url(r'^(?P<organization_slug>[\w_-]+)/(?P<project_slug>[\w_-]+)/issues/(?P<group_id>\d+)/actions/(?P<slug>[\w_-]+)/', GroupPluginActionView.as_view(),
        name='sentry-group-plugin-action'),

    # Legacy
    url(r'', react_page_view),
)
