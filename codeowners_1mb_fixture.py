CODEOWNERS = """
# -*- tab-width: 106; -*-
# Please keep this file in ascending alphabetical order.
# This is a CODEOWNERS file. See https://help.github.com/articles/about-codeowners/
.devcontainer                                                                                             @getsentry/pingu
.dockerignore                                                                                             @getsentry/squonk
.github/CONTRIBUTING.md                                                                                   @getsentry/squonk @getsentry/bolt
.github/PULL_REQUEST_TEMPLATE.md                                                                          @getsentry/squonk @getsentry/bolt
.github/PULL_REQUEST_TEMPLATE/vinyl.md                                                                    @getsentry/vinyl
.github/dependabot.yml                                                                                    @getsentry/squonk @getsentry/bolt
.github/scooter-bot.yml                                                                                   @getsentry/squonk
.github/stale.yml                                                                                         @getsentry/squonk @getsentry/bolt
.github/workflows/                                                                                        @getsentry/squonk @getsentry/bolt
.ruby-version                                                                                             @getsentry/squonk @getsentry/bolt
.yamllint.yml                                                                                             @getsentry/classic-core-cph
Capfile                                                                                                   @getsentry/squonk
DEPLOY.md                                                                                                 @getsentry/squonk @getsentry/bolt
Dockerfile                                                                                                @getsentry/squonk @getsentry/bolt
app/assets/javascripts/admin.js                                                                           @getsentry/fang @getsentry/libretto
app/assets/javascripts/admin/vendor/admin_assets/admin.js                                                 @getsentry/iris
app/assets/javascripts/api/macro.js                                                                       @getsentry/fang
app/assets/javascripts/brands/email_fb_integration_field.module.js                                        @getsentry/strongbad
app/assets/javascripts/mobile/                                                                            @getsentry/lir
app/assets/javascripts/mobile_sdk.js                                                                      @getsentry/lir
app/assets/javascripts/nested_hash.js                                                                     @getsentry/orchid
app/assets/javascripts/new_rule.js                                                                        @getsentry/fang @getsentry/libretto
app/assets/javascripts/password_requirements.js                                                           @getsentry/secdev @getsentry/unagi
app/assets/javascripts/routing.js                                                                         @getsentry/argonauts
app/assets/javascripts/rule.js                                                                            @getsentry/fang @getsentry/libretto
app/assets/javascripts/rule_data.js                                                                       @getsentry/fang @getsentry/libretto
app/assets/javascripts/settings/slas.js                                                                   @getsentry/fang
app/assets/javascripts/vendor/jstz.js                                                                     @getsentry/secdev @getsentry/unagi
app/assets/javascripts/vendor/turbolinks.js                                                               @getsentry/secdev @getsentry/unagi
app/assets/javascripts/vendor/ua-parser.min.js                                                            @getsentry/secdev @getsentry/unagi
app/assets/javascripts/views/access/                                                                      @getsentry/secdev @getsentry/unagi
app/assets/javascripts/views/cms/index.js                                                                 @getsentry/athene
app/assets/javascripts/views/cms/texts.js                                                                 @getsentry/athene
app/assets/javascripts/views/people/                                                                      @getsentry/bilby
app/assets/javascripts/views/people/roles/*                                                               @getsentry/firefly @getsentry/bilby
app/assets/javascripts/views/rules/                                                                       @getsentry/fang @getsentry/libretto
app/assets/javascripts/views/satisfaction_ratings/_rating_box.js                                          @getsentry/fang
app/assets/javascripts/views/settings/customers/satisfaction_reasons.js                                   @getsentry/fang
app/assets/javascripts/views/settings/email/recipient_address.js                                          @getsentry/strongbad
app/assets/javascripts/views/shared/_macro_list.js                                                        @getsentry/fang
app/assets/javascripts/views/tickets/*                                                                    @getsentry/boxoffice @getsentry/popcorn
app/assets/javascripts/workspaces.js                                                                      @getsentry/kingfisher
app/assets/javascripts/zd_rule_data.js                                                                    @getsentry/fang @getsentry/libretto
app/assets/javascripts/zendesk/auth/                                                                      @getsentry/secdev @getsentry/unagi
app/assets/javascripts/zendesk_auth/                                                                      @getsentry/secdev @getsentry/unagi
app/assets/javascripts/zendesk_survey_support_churn_v3.js                                                 @getsentry/belugas
app/assets/stylesheets/admin.css                                                                          @getsentry/fang @getsentry/libretto
app/assets/stylesheets/embedded_lotus_overrides.css                                                       @getsentry/collaboration
app/assets/stylesheets/garden/                                                                            @getsentry/squonk
app/assets/stylesheets/global/_clean.css.scss                                                             @getsentry/squonk
app/assets/stylesheets/global/_embedded_lotus_overrides.css.scss                                          @getsentry/collaboration
app/assets/stylesheets/roles/*                                                                            @getsentry/firefly
app/assets/stylesheets/routing.css                                                                        @getsentry/argonauts
app/assets/stylesheets/settings/slas.css                                                                  @getsentry/fang
app/assets/stylesheets/views/access/                                                                      @getsentry/secdev @getsentry/unagi
app/assets/stylesheets/views/account/_settings.css.scss                                                   @getsentry/strongbad
app/assets/stylesheets/views/cms/_index.css.scss                                                          @getsentry/athene
app/assets/stylesheets/views/mobile_sdk/                                                                  @getsentry/lir
app/assets/stylesheets/views/people/_groups.css.scss                                                      @getsentry/firefly
app/assets/stylesheets/views/rules/                                                                       @getsentry/fang @getsentry/libretto
app/assets/stylesheets/views/rules/analytics/_index.css.scss                                              @getsentry/fang @getsentry/libretto
app/assets/stylesheets/views/satisfaction_ratings/_agent.css.scss                                         @getsentry/fang
app/assets/stylesheets/views/satisfaction_ratings/_rating_box.css.scss                                    @getsentry/fang
app/assets/stylesheets/views/settings/customers/_satisfaction_ratings.css.scss                            @getsentry/fang
app/assets/stylesheets/views/settings/customers/_satisfaction_reasons.css.scss                            @getsentry/fang
app/assets/stylesheets/views/settings/customers/_settings.css.scss                                        @getsentry/strongbad
app/assets/stylesheets/views/settings/email/                                                              @getsentry/strongbad
app/assets/stylesheets/views/shared/_macro_list.css.scss                                                  @getsentry/fang
app/assets/stylesheets/views/sharing/agreements.css.scss                                                  @getsentry/boxoffice @getsentry/popcorn
app/assets/stylesheets/views/targets/                                                                     @getsentry/vegemite
app/assets/stylesheets/views/tickets/*                                                                    @getsentry/boxoffice @getsentry/popcorn
app/assets/stylesheets/views/voice/                                                                       @getsentry/voice
app/backfills/activate_voice_partner_edition_account.rb                                                   @getsentry/zenguins
app/backfills/add_facebook_page_scoped_id.rb                                                              @getsentry/ocean
app/backfills/aw_self_serve_migration_control_setting_change.rb                                           @getsentry/iris
app/backfills/backfill_account_groups_limit.rb                                                            @getsentry/bolt
app/backfills/backfill_account_products.rb                                                                @getsentry/bilby
app/backfills/backfill_blanked_settings.rb                                                                @getsentry/bilby
app/backfills/backfill_cleanup_group_memberships_for_accounts.rb                                          @getsentry/bolt @getsentry/bilby
app/backfills/backfill_correct_mobile_sdk_apps.rb                                                         @getsentry/lir
app/backfills/backfill_deactivate_unused_handles_data_v2.csv                                              @getsentry/ocean
app/backfills/backfill_delete_policies_with_deleted_permission_sets.rb                                    @getsentry/space-dogs
app/backfills/backfill_delete_user_seats_for_deleted_users.rb                                             @getsentry/voice
app/backfills/backfill_inbound_mail_rate_limits.rb                                                        @getsentry/strongbad
app/backfills/backfill_lets_encrypt_cert_chain.rb                                                         @getsentry/secdev
app/backfills/backfill_macro_suggestions.rb                                                               @getsentry/fang
app/backfills/backfill_macro_suggestions_production.csv                                                   @getsentry/fang
app/backfills/backfill_macro_suggestions_staging.csv                                                      @getsentry/fang
app/backfills/backfill_nil_ticket_organization.rb                                                         @getsentry/boxoffice @getsentry/popcorn @getsentry/bilby
app/backfills/backfill_permission_set_policies.rb                                                         @getsentry/space-dogs
app/backfills/backfill_remove_voice_insight_fields.rb                                                     @getsentry/kelpie
app/backfills/backfill_remove_voice_seats_off_inactive_users.rb                                           @getsentry/red-pandas
app/backfills/backfill_sandbox_type.rb                                                                    @getsentry/ngiyari @getsentry/pcc-operations
app/backfills/backfill_status.rb                                                                          @getsentry/piratos
app/backfills/backfill_ticket_tags.rb                                                                     @getsentry/piratos
app/backfills/backfill_update_cfc_ris_manifest.rb                                                         @getsentry/ocean
app/backfills/backfill_user_memberships_limit.rb                                                          @getsentry/bolt
app/backfills/backfill_views_serve_count_from_es.rb                                                       @getsentry/ingest
app/backfills/backfill_views_ticket_stream.rb                                                             @getsentry/ingest
app/backfills/backfill_zis_oauth_client_name.rb                                                           @getsentry/platypus
app/backfills/backfill_zopim_subscription_purchased_at.rb                                                 @getsentry/narwhals @getsentry/otters
app/backfills/delete_account_attachments.rb                                                               @getsentry/squonk
app/backfills/delete_data_deletion_job_failed_audits.rb                                                   @getsentry/account-data-deletion
app/backfills/delete_duplicated_system_permission_sets.rb                                                 @getsentry/space-dogs
app/backfills/delete_user_sdk_identities.rb                                                               @getsentry/lir @getsentry/bilby
app/backfills/duplicate_organizations.rb                                                                  @getsentry/bilby
app/backfills/durable_backfill/tasks/backfill_account_attribute_ticket_map_cleanup.rb                     @getsentry/fang
app/backfills/durable_backfill/tasks/backfill_account_trigger_categories_migration.rb                     @getsentry/libretto
app/backfills/durable_backfill/tasks/backfill_active_tickets_custom_status_id.rb                          @getsentry/boxoffice @getsentry/popcorn
app/backfills/durable_backfill/tasks/backfill_admin_permission_set.rb                                     @getsentry/space-dogs
app/backfills/durable_backfill/tasks/backfill_archived_tickets_custom_status_id.rb                        @getsentry/boxoffice @getsentry/popcorn
app/backfills/durable_backfill/tasks/backfill_assign_admin_permission_set_to_admins_v2.rb                 @getsentry/space-dogs
app/backfills/durable_backfill/tasks/backfill_billing_admin_permission_set.rb                             @getsentry/space-dogs
app/backfills/durable_backfill/tasks/backfill_billing_audits.rb                                           @getsentry/audit-log
app/backfills/durable_backfill/tasks/backfill_channels_twitter_oauth2_refresh_token_v2.rb                 @getsentry/ocean
app/backfills/durable_backfill/tasks/backfill_chat_ended_event.rb                                         @getsentry/orchid
app/backfills/durable_backfill/tasks/backfill_chat_only_agents_v2.rb                                      @getsentry/bilby
app/backfills/durable_backfill/tasks/backfill_convert_failed_incoming_conversions.rb                      @getsentry/ocean
app/backfills/durable_backfill/tasks/backfill_custom_field_options_limit_v2.rb                            @getsentry/boxoffice @getsentry/popcorn
app/backfills/durable_backfill/tasks/backfill_custom_role_explore_permission.rb                           @getsentry/bilby
app/backfills/durable_backfill/tasks/backfill_deactivate_unused_twitter_handles_v2.rb                     @getsentry/ocean
app/backfills/durable_backfill/tasks/backfill_default_signup_email_text.rb                                @getsentry/secdev
app/backfills/durable_backfill/tasks/backfill_delete_archived_or_dangling_outbound_emails.rb              @getsentry/strongbad
app/backfills/durable_backfill/tasks/backfill_delete_duplicated_system_permission_sets.rb                 @getsentry/space-dogs
app/backfills/durable_backfill/tasks/backfill_delete_duplicated_system_permission_sets_v2.rb              @getsentry/space-dogs
app/backfills/durable_backfill/tasks/backfill_delete_erroneous_light_agent_policies.rb                    @getsentry/space-dogs
app/backfills/durable_backfill/tasks/backfill_delete_organization_membership_v4.rb                        @getsentry/kowari
app/backfills/durable_backfill/tasks/backfill_delete_orphaned_group_memberships.rb                        @getsentry/bolt
app/backfills/durable_backfill/tasks/backfill_delete_orphaned_personal_macros.rb                          @getsentry/fang
app/backfills/durable_backfill/tasks/backfill_delete_orphaned_personal_macros_v2.rb                       @getsentry/fang
app/backfills/durable_backfill/tasks/backfill_delete_policies_with_deleted_permission_sets.rb             @getsentry/space-dogs
app/backfills/durable_backfill/tasks/backfill_email_synchronize_remote_files.rb                           @getsentry/strongbad
app/backfills/durable_backfill/tasks/backfill_email_synchronize_remote_files.txt                          @getsentry/strongbad
app/backfills/durable_backfill/tasks/backfill_facebook_monitor_feed_metadata.rb                           @getsentry/ocean
app/backfills/durable_backfill/tasks/backfill_facebook_promotable_post_metadata.rb                        @getsentry/ocean
app/backfills/durable_backfill/tasks/backfill_failed_gpi_channelbacks.rb                                  @getsentry/ocean
app/backfills/durable_backfill/tasks/backfill_failed_spf_verification.rb                                  @getsentry/strongbad
app/backfills/durable_backfill/tasks/backfill_force_retry_failed_targets_to_webhooks_migration.rb         @getsentry/vegemite
app/backfills/durable_backfill/tasks/backfill_force_targets_to_webhooks_migration.rb                      @getsentry/vegemite
app/backfills/durable_backfill/tasks/backfill_forced_target_migrations_rollback.rb                        @getsentry/vegemite
app/backfills/durable_backfill/tasks/backfill_gdpr_connect_app_cleanup.rb                                 @getsentry/spyglass
app/backfills/durable_backfill/tasks/backfill_hard_delete_organization_domains.rb                         @getsentry/kowari
app/backfills/durable_backfill/tasks/backfill_insert_default_custom_statuses.rb                           @getsentry/boxoffice @getsentry/popcorn
app/backfills/durable_backfill/tasks/backfill_manage_automations_to_permissions.rb                        @getsentry/space-dogs
app/backfills/durable_backfill/tasks/backfill_manage_triggers_to_permissions_v2.rb                        @getsentry/space-dogs
app/backfills/durable_backfill/tasks/backfill_organization_activity_email_template_v3.rb                  @getsentry/strongbad
app/backfills/durable_backfill/tasks/backfill_re_encrypt_targets_v1.rb                                    @getsentry/vegemite
app/backfills/durable_backfill/tasks/backfill_reactivate_facebook_pages.rb                                @getsentry/ocean
app/backfills/durable_backfill/tasks/backfill_remote_authentication_name_user_type.rb                     @getsentry/unagi
app/backfills/durable_backfill/tasks/backfill_resolve_ulaanbaatar_time_zone_spelling.rb                   @getsentry/i18n
app/backfills/durable_backfill/tasks/backfill_sandbox_archive_after_days.rb                               @getsentry/ticket-platform
app/backfills/durable_backfill/tasks/backfill_skill_based_attribute_ticket_mapping.rb                     @getsentry/bilby
app/backfills/durable_backfill/tasks/backfill_subscribe_monitored_twitter_handles_via_proxy_v5.rb         @getsentry/ocean
app/backfills/durable_backfill/tasks/backfill_targets_delete_plaintext_credentials_v2.rb                  @getsentry/vegemite
app/backfills/durable_backfill/tasks/backfill_ticket_access_to_permissions.rb                             @getsentry/space-dogs
app/backfills/durable_backfill/tasks/backfill_ticket_deflection_enquiry.rb                                @getsentry/waratah
app/backfills/durable_backfill/tasks/backfill_ticket_deflection_updated_at.rb                             @getsentry/waratah
app/backfills/durable_backfill/tasks/backfill_ticket_metric_set_removal_for_scrubbed_tickets.rb           @getsentry/fang
app/backfills/durable_backfill/tasks/backfill_ticket_public_if_comment_public.rb                          @getsentry/boxoffice @getsentry/popcorn
app/backfills/durable_backfill/tasks/backfill_update_cfc_ris_manifest_v3.rb                               @getsentry/ocean
app/backfills/durable_backfill/tasks/backfill_update_default_hold_custom_statuses.rb                      @getsentry/boxoffice @getsentry/popcorn
app/backfills/durable_backfill/tasks/backfill_update_tickets_with_nil_custom_status_id_event.rb           @getsentry/boxoffice @getsentry/popcorn
app/backfills/durable_backfill/tasks/backfill_update_type_id_in_instance_value.rb                         @getsentry/argonauts
app/backfills/durable_backfill/tasks/backfill_user_identity_to_user.rb                                    @getsentry/audit-log
app/backfills/durable_backfill/work_checkpointer.rb                                                       @getsentry/boxoffice @getsentry/popcorn
app/backfills/dynamodb_backfill/                                                                          @getsentry/ticket-platform
app/backfills/endusers_organization_cleanup.rb                                                            @getsentry/bilby
app/backfills/facebook_psid_migrate_to_external_id.rb                                                     @getsentry/ocean
app/backfills/fix_non_boostable_subscription_features.rb                                                  @getsentry/narwhals @getsentry/otters
app/backfills/hc_brands_backfill.rb                                                                       @getsentry/piratos
app/backfills/modify_vulnerable_triggers.rb                                                               @getsentry/orca
app/backfills/organization_membership_destroy.rb                                                          @getsentry/bilby
app/backfills/reconfigure_spammy_z3n_account_settings.rb                                                  @getsentry/orca
app/backfills/record_displacer.rb                                                                         @getsentry/dugong
app/backfills/remove_subscription_feature.rb                                                              @getsentry/narwhals @getsentry/otters
app/backfills/remove_talk_partner_edition_accounts_backfill.rb                                            @getsentry/zenguins
app/backfills/rename_custom_roles.rb                                                                      @getsentry/space-dogs
app/backfills/rename_deleted_organizations.rb                                                             @getsentry/bilby
app/backfills/routing_tasks_data_update.rb                                                                @getsentry/silk-road @getsentry/tea-horse
app/backfills/set_trial_expiration_date_for_open_ended_tpe_trials.rb                                      @getsentry/zenguins
app/backfills/skill_based_routing_backfill.rb                                                             @getsentry/argonauts
app/backfills/snapchat_ticket_ids.csv                                                                     @getsentry/squonk
app/backfills/soft_delete_attributes_from_instance_values.rb                                              @getsentry/argonauts
app/backfills/soft_delete_duplicate_talk_partner_edition_accounts.rb                                      @getsentry/zenguins
app/backfills/ticket_call_menu_experiment_account_ids.csv                                                 @getsentry/voice
app/backfills/ticket_metric_event_breach_remover.rb                                                       @getsentry/fang
app/backfills/truncate_cs_tables.rb                                                                       @getsentry/collections
app/backfills/update_type_id_in_instance_value.rb                                                         @getsentry/argonauts
app/backfills/user_entity_topic_backfill.rb                                                               @getsentry/piratos @getsentry/bilby
app/backfills/user_org_delete_memberships.rb                                                              @getsentry/bilby
app/backfills/user_org_fix_memberships.rb                                                                 @getsentry/bilby
app/backfills/voice_partner_edition_account_backfill.rb                                                   @getsentry/zenguins
app/consumers/brand_account_move_consumer.rb                                                              @getsentry/piratos
app/consumers/malware_scan_events_consumer.rb                                                             @getsentry/spyglass
app/consumers/routing_assignments_consumer.rb                                                             @getsentry/silk-road @getsentry/tea-horse
app/consumers/routing_assignments_consumer_log_formatter.rb                                               @getsentry/silk-road @getsentry/tea-horse
app/consumers/ticket_intent_consumer.rb                                                                   @getsentry/lynx
app/consumers/ticket_language_consumer.rb                                                                 @getsentry/lynx
app/consumers/ticket_metric_events_consumer.rb                                                            @getsentry/fang
app/consumers/ticket_metric_events_consumer_log_formatter.rb                                              @getsentry/fang
app/consumers/ticket_prediction_consumer/confidence.rb                                                    @getsentry/lynx
app/consumers/ticket_prediction_consumer/metrics.rb                                                       @getsentry/lynx
app/consumers/ticket_prediction_consumer/ticket_consumer_processor.rb                                     @getsentry/lynx
app/consumers/user_account_move_consumer.rb                                                               @getsentry/piratos @getsentry/bilby
app/consumers/user_id_sync_consumer.rb                                                                    @getsentry/piratos @getsentry/bilby
app/consumers/views_entity_stream_account_move_completion_consumer.rb                                     @getsentry/ingest
app/consumers/views_entity_stream_account_move_participant_consumer.rb                                    @getsentry/ingest
app/consumers/views_ticket_entities_republisher.rb                                                        @getsentry/ingest
app/consumers/views_ticket_entities_republisher/*                                                         @getsentry/ingest
app/controllers/access_controller.rb                                                                      @getsentry/unagi @getsentry/lir
app/controllers/account/subscription_controller.rb                                                        @getsentry/narwhals @getsentry/otters
app/controllers/account_setup_controller.rb                                                               @getsentry/quoll
app/controllers/accounts_controller.rb                                                                    @getsentry/quoll
app/controllers/acme_challenges_controller.rb                                                             @getsentry/secdev
app/controllers/activate_trial_controller.rb                                                              @getsentry/ponderosa @getsentry/ngiyari @getsentry/pcc-operations
app/controllers/admin_controller.rb                                                                       @getsentry/fang @getsentry/libretto
app/controllers/admin_password_reset_requests_controller.rb                                               @getsentry/secdev @getsentry/unagi
app/controllers/api/base_controller.rb                                                                    @getsentry/bolt
app/controllers/api/lotus/activities_controller.rb                                                        @getsentry/harrier
app/controllers/api/lotus/agents_controller.rb                                                            @getsentry/harrier
app/controllers/api/lotus/assignables/                                                                    @getsentry/harrier
app/controllers/api/lotus/ccs_and_followers/                                                              @getsentry/strongbad
app/controllers/api/lotus/chat_migrations_controller.rb                                                   @getsentry/teapot @getsentry/tealeaves
app/controllers/api/lotus/chat_settings_controller.rb                                                     @getsentry/iris
app/controllers/api/lotus/conversations_controller.rb                                                     @getsentry/orchid
app/controllers/api/lotus/groups_controller.rb                                                            @getsentry/harrier
app/controllers/api/lotus/knowledge_events_controller.rb                                                  @getsentry/orchid
app/controllers/api/lotus/macros_controller.rb                                                            @getsentry/fang
app/controllers/api/lotus/manifests_controller.rb                                                         @getsentry/harrier
app/controllers/api/lotus/simplified_email_threading/                                                     @getsentry/strongbad
app/controllers/api/lotus/ticket_activity_presenter.rb                                                    @getsentry/harrier
app/controllers/api/lotus/tickets_controller.rb                                                           @getsentry/orchid
app/controllers/api/lotus/time_zones_controller.rb                                                        @getsentry/harrier
app/controllers/api/lotus/trigger_categories_migration_controller.rb                                      @getsentry/libretto
app/controllers/api/mobile/                                                                               @getsentry/lir
app/controllers/api/mobile/account/groups_controller.rb                                                   @getsentry/lir @getsentry/bolt
app/controllers/api/mobile/current_user_controller.rb                                                     @getsentry/lir @getsentry/bilby
app/controllers/api/mobile/user_fields_controller.rb                                                      @getsentry/lir @getsentry/bilby @getsentry/vinyl
app/controllers/api/mobile/user_tags_controller.rb                                                        @getsentry/lir @getsentry/bilby
app/controllers/api/private/mobile_sdk/                                                                   @getsentry/lir
app/controllers/api/services/salesforce/                                                                  @getsentry/platycorn
app/controllers/api/v1/base_controller.rb                                                                 @getsentry/bolt
app/controllers/api/v1/stats_controller.rb                                                                @getsentry/foundation-analytics-stream
app/controllers/api/v2/account/addons_controller.rb                                                       @getsentry/narwhals @getsentry/otters
app/controllers/api/v2/account/boosts_controller.rb                                                       @getsentry/narwhals @getsentry/otters
app/controllers/api/v2/account/explore_subscription/subscription_controller.rb                            @getsentry/kepler
app/controllers/api/v2/account/features_controller.rb                                                     @getsentry/quoll
app/controllers/api/v2/account/sandboxes_controller.rb                                                    @getsentry/ngiyari @getsentry/pcc-operations
app/controllers/api/v2/account/settings_controller.rb                                                     @getsentry/bolt
app/controllers/api/v2/account/subscription_controller.rb                                                 @getsentry/narwhals @getsentry/otters
app/controllers/api/v2/account/voice_subscription/recharge_settings_controller.rb                         @getsentry/narwhals @getsentry/otters
app/controllers/api/v2/account/zopim_agents_controller.rb                                                 @getsentry/fangorn
app/controllers/api/v2/account/zopim_subscription_controller.rb                                           @getsentry/fangorn
app/controllers/api/v2/accounts_controller.rb                                                             @getsentry/quoll
app/controllers/api/v2/accounts_creation_controller.rb                                                    @getsentry/quoll
app/controllers/api/v2/attachments_controller.rb                                                          @getsentry/squonk
app/controllers/api/v2/audit_logs_controller.rb                                                           @getsentry/audit-log
app/controllers/api/v2/audits_controller.rb                                                               @getsentry/ticket-platform
app/controllers/api/v2/auth_billing/                                                                      @getsentry/narwhals @getsentry/otters
app/controllers/api/v2/autocomplete_controller.rb                                                         @getsentry/boxoffice @getsentry/popcorn
app/controllers/api/v2/base_controller.rb                                                                 @getsentry/bolt
app/controllers/api/v2/base_custom_field_options_controller.rb                                            @getsentry/boxoffice @getsentry/popcorn
app/controllers/api/v2/billing/                                                                           @getsentry/narwhals @getsentry/otters
app/controllers/api/v2/brands_controller.rb                                                               @getsentry/boxoffice @getsentry/popcorn
app/controllers/api/v2/channels/voice/                                                                    @getsentry/zenguins
app/controllers/api/v2/chat_file_redactions_controller.rb                                                 @getsentry/orchid
app/controllers/api/v2/chat_redactions_controller.rb                                                      @getsentry/orchid
app/controllers/api/v2/collaborators_controller.rb                                                        @getsentry/strongbad
app/controllers/api/v2/comment_redactions_controller.rb                                                   @getsentry/orchid
app/controllers/api/v2/cors_controller.rb                                                                 @getsentry/secdev
app/controllers/api/v2/countries_controller.rb                                                            @getsentry/i18n
app/controllers/api/v2/crm_data_controller.rb                                                             @getsentry/platycorn
app/controllers/api/v2/current_account_controller.rb                                                      @getsentry/quoll
app/controllers/api/v2/current_user_controller.rb                                                         @getsentry/bilby
app/controllers/api/v2/custom_fields_controller.rb                                                        @getsentry/boxoffice @getsentry/popcorn @getsentry/vinyl
app/controllers/api/v2/custom_roles_controller.rb                                                         @getsentry/firefly
app/controllers/api/v2/custom_status/defaults_controller.rb                                               @getsentry/boxoffice @getsentry/popcorn
app/controllers/api/v2/custom_statuses_controller.rb                                                      @getsentry/boxoffice @getsentry/popcorn
app/controllers/api/v2/deleted_tickets_controller.rb                                                      @getsentry/boxoffice @getsentry/popcorn
app/controllers/api/v2/deleted_users_controller.rb                                                        @getsentry/bilby @getsentry/spyglass
app/controllers/api/v2/dynamic_content/items_controller.rb                                                @getsentry/athene
app/controllers/api/v2/dynamic_content/variants_controller.rb                                             @getsentry/athene
app/controllers/api/v2/email_ccs_controller.rb                                                            @getsentry/strongbad
app/controllers/api/v2/embeddable/config_sets_controller.rb                                               @getsentry/copperhead
app/controllers/api/v2/end_user_identities_controller.rb                                                  @getsentry/bilby
app/controllers/api/v2/end_users_controller.rb                                                            @getsentry/bilby
app/controllers/api/v2/errors_controller.rb                                                               @getsentry/bolt
app/controllers/api/v2/exports/base_controller.rb                                                         @getsentry/bolt
app/controllers/api/v2/exports/gooddata_controller.rb                                                     @getsentry/waratah
app/controllers/api/v2/exports/tickets_controller.rb                                                      @getsentry/dugong
app/controllers/api/v2/external_email_credentials_controller.rb                                           @getsentry/strongbad
app/controllers/api/v2/feature_usage_metrics_controller.rb                                                @getsentry/fang @getsentry/libretto
app/controllers/api/v2/followers_controller.rb                                                            @getsentry/strongbad
app/controllers/api/v2/forwarding_verification_tokens_controller.rb                                       @getsentry/secdev
app/controllers/api/v2/gooddata_integration_controller.rb                                                 @getsentry/waratah
app/controllers/api/v2/gooddata_users_controller.rb                                                       @getsentry/waratah
app/controllers/api/v2/group_memberships_controller.rb                                                    @getsentry/bolt @getsentry/bilby
app/controllers/api/v2/groups_controller.rb                                                               @getsentry/bolt @getsentry/teapot @getsentry/tealeaves
app/controllers/api/v2/help_center/organization_subscriptions_controller.rb                               @getsentry/bilby @getsentry/kowari
app/controllers/api/v2/help_center/subscriptions_controller_support.rb                                    @getsentry/bilby
app/controllers/api/v2/identities_controller.rb                                                           @getsentry/bilby
app/controllers/api/v2/imports/tickets_controller.rb                                                      @getsentry/ticket-platform
app/controllers/api/v2/incidents_controller.rb                                                            @getsentry/boxoffice @getsentry/popcorn
app/controllers/api/v2/incremental/automatic_answers_controller.rb                                        @getsentry/waratah
app/controllers/api/v2/incremental/organizations_controller.rb                                            @getsentry/kowari
app/controllers/api/v2/incremental/routing_controller.rb                                                  @getsentry/argonauts
app/controllers/api/v2/incremental/ticket_events_controller.rb                                            @getsentry/dugong
app/controllers/api/v2/incremental/ticket_metric_events_controller.rb                                     @getsentry/fang
app/controllers/api/v2/incremental/tickets_controller.rb                                                  @getsentry/dugong
app/controllers/api/v2/incremental/users_controller.rb                                                    @getsentry/bilby
app/controllers/api/v2/integrations/jira_controller.rb                                                    @getsentry/pegasus
app/controllers/api/v2/internal/account_events_controller.rb                                              @getsentry/bilby @getsentry/quoll @getsentry/rakali
app/controllers/api/v2/internal/account_settings_controller.rb                                            @getsentry/teapot @getsentry/tealeaves @getsentry/nautilus @getsentry/nautilus-sonar
app/controllers/api/v2/internal/addon_boosts_controller.rb                                                @getsentry/narwhals @getsentry/otters
app/controllers/api/v2/internal/answer_bot/                                                               @getsentry/answer-bot
app/controllers/api/v2/internal/app_market/accounts_controller.rb                                         @getsentry/dingo
app/controllers/api/v2/internal/audit_emails_controller.rb                                                @getsentry/strongbad
app/controllers/api/v2/internal/audit_logs_controller.rb                                                  @getsentry/audit-log
app/controllers/api/v2/internal/audits_controller.rb                                                      @getsentry/fang @getsentry/libretto
app/controllers/api/v2/internal/base_controller.rb                                                        @getsentry/bolt
app/controllers/api/v2/internal/billing/                                                                  @getsentry/narwhals @getsentry/otters
app/controllers/api/v2/internal/boosts_controller.rb                                                      @getsentry/narwhals @getsentry/otters
app/controllers/api/v2/internal/brands_controller.rb                                                      @getsentry/boxoffice @getsentry/popcorn
app/controllers/api/v2/internal/certificate_moves_controller.rb                                           @getsentry/exodus @getsentry/secdev
app/controllers/api/v2/internal/certificates_controller.rb                                                @getsentry/secdev
app/controllers/api/v2/internal/challenge_token_controller.rb                                             @getsentry/secdev
app/controllers/api/v2/internal/chat/tickets_controller.rb                                                @getsentry/teapot @getsentry/tealeaves
app/controllers/api/v2/internal/collaboration/                                                            @getsentry/collaboration
app/controllers/api/v2/internal/compliance_moves_controller.rb                                            @getsentry/productivity-deploy
app/controllers/api/v2/internal/custom_roles_controller.rb                                                @getsentry/firefly
app/controllers/api/v2/internal/data_deletion_audits_controller.rb                                        @getsentry/account-data-deletion
app/controllers/api/v2/internal/emails_controller.rb                                                      @getsentry/bilby @getsentry/space-dogs
app/controllers/api/v2/internal/entity_lookup/views_tickets_controller.rb                                 @getsentry/ingest
app/controllers/api/v2/internal/entity_publication/views_tickets_controller.rb                            @getsentry/ingest
app/controllers/api/v2/internal/expirable_attachments_controller.rb                                       @getsentry/squonk
app/controllers/api/v2/internal/field_export_controller.rb                                                @getsentry/boxoffice @getsentry/popcorn
app/controllers/api/v2/internal/fraud_*                                                                   @getsentry/orca
app/controllers/api/v2/internal/global_inbound_mail_rate_limits_controller.rb                             @getsentry/strongbad
app/controllers/api/v2/internal/gooddata_integration_controller.rb                                        @getsentry/waratah
app/controllers/api/v2/internal/help_center_states_controller.rb                                          @getsentry/guide-dev
app/controllers/api/v2/internal/inbound_mail_rate_limits_controller.rb                                    @getsentry/strongbad
app/controllers/api/v2/internal/ipm/base_controller.rb                                                    @getsentry/bolt
app/controllers/api/v2/internal/mobile_sdk_settings_controller.rb                                         @getsentry/lir
app/controllers/api/v2/internal/monitor/base_controller.rb                                                @getsentry/bolt
app/controllers/api/v2/internal/monitor/conditional_rate_limits_controller.rb                             @getsentry/bilby
app/controllers/api/v2/internal/monitor/entitlements_controller.rb                                        @getsentry/rakali
app/controllers/api/v2/internal/monitor/fraud*                                                            @getsentry/orca
app/controllers/api/v2/internal/monitor/mobile_sdk_app_settings_controller.rb                             @getsentry/lir
app/controllers/api/v2/internal/monitor/mobile_sdk_blips_controller.rb                                    @getsentry/lir
app/controllers/api/v2/internal/monitor/subscriptions_controller.rb                                       @getsentry/narwhals @getsentry/otters
app/controllers/api/v2/internal/monitor_controller.rb                                                     @getsentry/monitor
app/controllers/api/v2/internal/password_controller.rb                                                    @getsentry/secdev @getsentry/unagi
app/controllers/api/v2/internal/pod_moves_controller.rb                                                   @getsentry/exodus
app/controllers/api/v2/internal/prediction_settings_controller.rb                                         @getsentry/waratah
app/controllers/api/v2/internal/radar_controller.rb                                                       @getsentry/argonauts
app/controllers/api/v2/internal/recipient_addresses_controller.rb                                         @getsentry/strongbad
app/controllers/api/v2/internal/remote_authentications_controller.rb                                      @getsentry/unagi
app/controllers/api/v2/internal/role_mapping_controller.rb                                                @getsentry/rakali
app/controllers/api/v2/internal/sandboxes_controller.rb                                                   @getsentry/ngiyari @getsentry/pcc-operations
app/controllers/api/v2/internal/secondary_subscriptions_controller.rb                                     @getsentry/narwhals @getsentry/otters
app/controllers/api/v2/internal/security_settings_controller.rb                                           @getsentry/secdev @getsentry/unagi
app/controllers/api/v2/internal/spf_verification_controller.rb                                            @getsentry/strongbad
app/controllers/api/v2/internal/staff_controller.rb                                                       @getsentry/turtle
app/controllers/api/v2/internal/staff_events_controller.rb                                                @getsentry/bilby
app/controllers/api/v2/internal/tickets_controller.rb                                                     @getsentry/boxoffice @getsentry/popcorn
app/controllers/api/v2/internal/unmigrate_controller.rb                                                   @getsentry/ticket-platform
app/controllers/api/v2/internal/user_otp_settings_controller.rb                                           @getsentry/secdev @getsentry/bilby
app/controllers/api/v2/internal/user_reports_controller.rb                                                @getsentry/bilby
app/controllers/api/v2/internal/users_controller.rb                                                       @getsentry/secdev @getsentry/bilby
app/controllers/api/v2/internal/voice/                                                                    @getsentry/voice
app/controllers/api/v2/internal/voice/user_phone_number_identities_controller.rb                          @getsentry/voice @getsentry/bilby
app/controllers/api/v2/internal/voyager/voyager_exports_controller.rb                                     @getsentry/views-enablement
app/controllers/api/v2/internal/zopim/satisfaction_ratings_controller.rb                                  @getsentry/fang
app/controllers/api/v2/internal/zopim_subscription_controller.rb                                          @getsentry/narwhals @getsentry/otters
app/controllers/api/v2/jetpack_tasks_controller.rb                                                        @getsentry/ponderosa
app/controllers/api/v2/job_statuses_controller.rb                                                         @getsentry/bolt
app/controllers/api/v2/mail_inline_images_controller.rb                                                   @getsentry/strongbad
app/controllers/api/v2/mobile_devices_controller.rb                                                       @getsentry/lir
app/controllers/api/v2/mobile_sdk_apps_controller.rb                                                      @getsentry/lir
app/controllers/api/v2/onboarding_tasks_controller.rb                                                     @getsentry/ponderosa
app/controllers/api/v2/organization_fields_controller.rb                                                  @getsentry/kowari @getsentry/vinyl
app/controllers/api/v2/organization_memberships_controller.rb                                             @getsentry/kowari
app/controllers/api/v2/organizations_controller.rb                                                        @getsentry/kowari
app/controllers/api/v2/problems_controller.rb                                                             @getsentry/boxoffice @getsentry/popcorn
app/controllers/api/v2/products/suite.rb                                                                  @getsentry/wallaby
app/controllers/api/v2/products_controller.rb                                                             @getsentry/wallaby
app/controllers/api/v2/push_notification_devices_controller.rb                                            @getsentry/lir
app/controllers/api/v2/recipient_addresses_controller.rb                                                  @getsentry/strongbad
app/controllers/api/v2/relationship_sources_controller.rb                                                 @getsentry/vinyl
app/controllers/api/v2/requests/comments_controller.rb                                                    @getsentry/boxoffice @getsentry/popcorn
app/controllers/api/v2/requests_controller.rb                                                             @getsentry/boxoffice @getsentry/popcorn
app/controllers/api/v2/resend_owner_welcome_email_controller.rb                                           @getsentry/secdev
app/controllers/api/v2/resource_collections_controller.rb                                                 @getsentry/dingo
app/controllers/api/v2/routing/                                                                           @getsentry/argonauts
app/controllers/api/v2/rules/                                                                             @getsentry/fang @getsentry/libretto
app/controllers/api/v2/rules/automations_controller.rb                                                    @getsentry/libretto
app/controllers/api/v2/rules/categories/                                                                  @getsentry/libretto
app/controllers/api/v2/rules/macro_attachments_controller.rb                                              @getsentry/fang
app/controllers/api/v2/rules/macros_controller.rb                                                         @getsentry/fang
app/controllers/api/v2/rules/previews_controller.rb                                                       @getsentry/views-core @getsentry/views-enablement
app/controllers/api/v2/rules/relationship_definitions_controller.rb                                       @getsentry/vinyl
app/controllers/api/v2/rules/trigger_revisions_controller.rb                                              @getsentry/libretto
app/controllers/api/v2/rules/triggers_controller.rb                                                       @getsentry/libretto
app/controllers/api/v2/rules/user_views_controller.rb                                                     @getsentry/penguin
app/controllers/api/v2/rules/views_controller.rb                                                          @getsentry/views-core @getsentry/views-enablement
app/controllers/api/v2/satisfaction_prediction_surveys_controller.rb                                      @getsentry/fang
app/controllers/api/v2/satisfaction_ratings_controller.rb                                                 @getsentry/fang
app/controllers/api/v2/satisfaction_reasons_controller.rb                                                 @getsentry/fang
app/controllers/api/v2/search_controller.rb                                                               @getsentry/search
app/controllers/api/v2/sessions_controller.rb                                                             @getsentry/secdev
app/controllers/api/v2/sharing_agreements_controller.rb                                                   @getsentry/boxoffice @getsentry/popcorn
app/controllers/api/v2/skips_controller.rb                                                                @getsentry/argonauts
app/controllers/api/v2/slas/                                                                              @getsentry/fang
app/controllers/api/v2/suspended_tickets_controller.rb                                                    @getsentry/strongbad
app/controllers/api/v2/tags_controller.rb                                                                 @getsentry/boxoffice @getsentry/popcorn
app/controllers/api/v2/target_failures_controller.rb                                                      @getsentry/vegemite
app/controllers/api/v2/targets_controller.rb                                                              @getsentry/vegemite
app/controllers/api/v2/ticket_fields/custom_field_options_controller.rb                                   @getsentry/boxoffice @getsentry/popcorn
app/controllers/api/v2/ticket_fields_controller.rb                                                        @getsentry/boxoffice @getsentry/popcorn @getsentry/vinyl
app/controllers/api/v2/ticket_forms_controller.rb                                                         @getsentry/boxoffice @getsentry/popcorn
app/controllers/api/v2/ticket_metrics_controller.rb                                                       @getsentry/fang
app/controllers/api/v2/tickets/attachments_controller.rb                                                  @getsentry/hibiscus
app/controllers/api/v2/tickets/comments_controller.rb                                                     @getsentry/orchid
app/controllers/api/v2/tickets_controller.rb                                                              @getsentry/boxoffice @getsentry/popcorn
app/controllers/api/v2/tracking/support_group_properties_controller.rb                                    @getsentry/bolt @getsentry/bilby
app/controllers/api/v2/tracking/support_user_properties_controller.rb                                     @getsentry/bilby
app/controllers/api/v2/user_fields/                                                                       @getsentry/bilby @getsentry/vinyl
app/controllers/api/v2/user_fields_controller.rb                                                          @getsentry/bilby @getsentry/vinyl
app/controllers/api/v2/users/compliance_deletion_statuses_controller.rb                                   @getsentry/spyglass @getsentry/bilby
app/controllers/api/v2/users/entitlements_controller.rb                                                   @getsentry/bilby
app/controllers/api/v2/users/password_controller.rb                                                       @getsentry/secdev @getsentry/bilby @getsentry/unagi
app/controllers/api/v2/users/settings_controller.rb                                                       @getsentry/bilby
app/controllers/api/v2/users/user_seats_controller.rb                                                     @getsentry/bilby @getsentry/voice
app/controllers/api/v2/users/zopim_identity_controller.rb                                                 @getsentry/bilby
app/controllers/api/v2/users_controller.rb                                                                @getsentry/bilby
app/controllers/api/v2/voice/                                                                             @getsentry/voice
app/controllers/api/v2/workspaces_controller.rb                                                           @getsentry/kingfisher
app/controllers/api/v2beta/base_controller.rb                                                             @getsentry/bolt
app/controllers/api/v2beta/crm_controller.rb                                                              @getsentry/platycorn
app/controllers/api/v2beta/tickets/related_controller.rb                                                  @getsentry/boxoffice @getsentry/popcorn
app/controllers/application_controller.rb                                                                 @getsentry/bolt
app/controllers/attachment_token_controller.rb                                                            @getsentry/squonk
app/controllers/attachments_controller.rb                                                                 @getsentry/squonk
app/controllers/attachments_controller_mixin.rb                                                           @getsentry/squonk
app/controllers/audit_emails_controller.rb                                                                @getsentry/strongbad
app/controllers/automatic_answers_embed_controller.rb                                                     @getsentry/waratah
app/controllers/brands_controller.rb                                                                      @getsentry/boxoffice @getsentry/popcorn
app/controllers/certificate_signing_request_controller.rb                                                 @getsentry/secdev
app/controllers/cms/base_controller.rb                                                                    @getsentry/athene
app/controllers/cms/search_controller.rb                                                                  @getsentry/athene
app/controllers/cms/texts_controller.rb                                                                   @getsentry/athene
app/controllers/cms/variants_controller.rb                                                                @getsentry/athene
app/controllers/crm_controller.rb                                                                         @getsentry/platycorn
app/controllers/expirable_attachments_controller.rb                                                       @getsentry/squonk
app/controllers/external_email_credentials_controller.rb                                                  @getsentry/strongbad
app/controllers/generated/base_controller.rb                                                              @getsentry/bolt
app/controllers/home_controller.rb                                                                        @getsentry/bolt
app/controllers/import_controller.rb                                                                      @getsentry/bilby
app/controllers/jobs_controller.rb                                                                        @getsentry/bilby
app/controllers/lotus_bootstrap_controller.rb                                                             @getsentry/harrier
app/controllers/mobile/                                                                                   @getsentry/lir
app/controllers/monkey_controller.rb                                                                      @getsentry/bolt
app/controllers/password_reset_requests_controller.rb                                                     @getsentry/secdev @getsentry/unagi
app/controllers/people/bulk_delete_controller.rb                                                          @getsentry/bilby
app/controllers/people/current_user_controller.rb                                                         @getsentry/bilby
app/controllers/people/groups_controller.rb                                                               @getsentry/bolt
app/controllers/people/organizations_controller.rb                                                        @getsentry/kowari
app/controllers/people/password_controller.rb                                                             @getsentry/secdev @getsentry/bilby @getsentry/unagi
app/controllers/people/permanently_delete_users_controller.rb                                             @getsentry/spyglass @getsentry/bilby
app/controllers/people/search_controller.rb                                                               @getsentry/bilby @getsentry/search
app/controllers/people/tags_controller.rb                                                                 @getsentry/boxoffice @getsentry/popcorn @getsentry/bilby
app/controllers/people/user_merge_controller.rb                                                           @getsentry/bilby
app/controllers/people/users_controller.rb                                                                @getsentry/bilby
app/controllers/photos_controller.rb                                                                      @getsentry/bilby
app/controllers/registration_controller.rb                                                                @getsentry/bilby @getsentry/secdev
app/controllers/reports_controller.rb                                                                     @getsentry/foundation-analytics-stream
app/controllers/requests/anonymous_controller.rb                                                          @getsentry/boxoffice @getsentry/popcorn
app/controllers/requests/base_controller.rb                                                               @getsentry/bolt
app/controllers/requests/embedded_controller.rb                                                           @getsentry/bolt
app/controllers/requests/mobile_api_controller.rb                                                         @getsentry/lir
app/controllers/requests/organization_controller.rb                                                       @getsentry/kowari
app/controllers/robots_controller.rb                                                                      @getsentry/enigma
app/controllers/routing_errors_controller.rb                                                              @getsentry/bolt
app/controllers/rules/                                                                                    @getsentry/fang @getsentry/libretto
app/controllers/rules/automations_controller.rb                                                           @getsentry/libretto
app/controllers/rules/count_controller.rb                                                                 @getsentry/views-core @getsentry/views-enablement
app/controllers/rules/tickets_controller.rb                                                               @getsentry/views-core @getsentry/views-enablement
app/controllers/rules/triggers_controller.rb                                                              @getsentry/libretto
app/controllers/rules/views_controller.rb                                                                 @getsentry/views-core @getsentry/views-enablement
app/controllers/rules_controller.rb                                                                       @getsentry/views-core @getsentry/views-enablement
app/controllers/satisfaction_ratings_controller.rb                                                        @getsentry/fang
app/controllers/settings/agents_controller.rb                                                             @getsentry/space-dogs @getsentry/firefly
app/controllers/settings/base_controller.rb                                                               @getsentry/bolt
app/controllers/settings/channels_controller.rb                                                           @getsentry/ocean
app/controllers/settings/chat_controller.rb                                                               @getsentry/fangorn
app/controllers/settings/customers_controller.rb                                                          @getsentry/bilby
app/controllers/settings/email_controller.rb                                                              @getsentry/strongbad
app/controllers/settings/export_configuration_controller.rb                                               @getsentry/views-enablement
app/controllers/settings/extensions_controller.rb                                                         @getsentry/platycorn
app/controllers/settings/recipient_addresses_controller.rb                                                @getsentry/strongbad
app/controllers/settings/security_controller.rb                                                           @getsentry/secdev @getsentry/unagi
app/controllers/settings/slas_controller.rb                                                               @getsentry/fang
app/controllers/settings/tickets_controller.rb                                                            @getsentry/boxoffice @getsentry/popcorn
app/controllers/sharing/                                                                                  @getsentry/boxoffice @getsentry/popcorn
app/controllers/sharing_agreements_controller.rb                                                          @getsentry/boxoffice @getsentry/popcorn
app/controllers/sharing_controller.rb                                                                     @getsentry/boxoffice @getsentry/popcorn
app/controllers/survey_controller.rb                                                                      @getsentry/belugas
app/controllers/suspended_tickets_controller.rb                                                           @getsentry/strongbad
app/controllers/tags_controller.rb                                                                        @getsentry/boxoffice @getsentry/popcorn
app/controllers/targets_controller.rb                                                                     @getsentry/vegemite
app/controllers/ticket_deflection_controller.rb                                                           @getsentry/waratah
app/controllers/ticket_fields_controller.rb                                                               @getsentry/boxoffice @getsentry/popcorn @getsentry/vinyl
app/controllers/tickets/merge_controller.rb                                                               @getsentry/boxoffice @getsentry/popcorn
app/controllers/tickets_controller.rb                                                                     @getsentry/boxoffice @getsentry/popcorn @getsentry/ticket-platform
app/controllers/twitter/reviewed_tweets_controller.rb                                                     @getsentry/ocean
app/controllers/user_identities_controller.rb                                                             @getsentry/bilby
app/controllers/verification_controller.rb                                                                @getsentry/unagi
app/controllers/voice/                                                                                    @getsentry/voice
app/controllers/voyager/voyager_exports_controller.rb                                                     @getsentry/views-enablement
app/controllers/zopim_chat_redirection_mixin.rb                                                           @getsentry/teapot @getsentry/tealeaves
app/controllers/zopim_chat_start_controller.rb                                                            @getsentry/teapot @getsentry/tealeaves
app/controllers/zuora/                                                                                    @getsentry/narwhals @getsentry/otters
app/helpers/access_helper.rb                                                                              @getsentry/secdev
app/helpers/admin_helper.rb                                                                               @getsentry/fang @getsentry/libretto
app/helpers/api/v2/internal/security_settings_errors_formatter_helper.rb                                  @getsentry/secdev @getsentry/unagi
app/helpers/api/v2/internal/subscription_features_helper.rb                                               @getsentry/narwhals @getsentry/otters
app/helpers/api/v2/rules_helper.rb                                                                        @getsentry/libretto
app/helpers/audits_helper.rb                                                                              @getsentry/audit-log
app/helpers/automatic_answers/authentication_helper.rb                                                    @getsentry/waratah
app/helpers/automatic_answers/tagging_helper.rb                                                           @getsentry/waratah
app/helpers/billing_helper.rb                                                                             @getsentry/narwhals @getsentry/otters
app/helpers/cms/view_helper.rb                                                                            @getsentry/athene
app/helpers/country_helper.rb                                                                             @getsentry/red-pandas
app/helpers/db_error_helper.rb                                                                            @getsentry/classic-core-cph
app/helpers/emoji_helper.rb                                                                               @getsentry/orchid
app/helpers/import_helper.rb                                                                              @getsentry/penguin
app/helpers/ledger_rate_limit_helper.rb                                                                   @getsentry/bilby
app/helpers/lotus_bootstrap_helper.rb                                                                     @getsentry/harrier
app/helpers/macro_list_helper.rb                                                                          @getsentry/fang
app/helpers/merge_helper.rb                                                                               @getsentry/strongbad
app/helpers/organizations_helper.rb                                                                       @getsentry/kowari
app/helpers/people/                                                                                       @getsentry/bilby
app/helpers/people_helper.rb                                                                              @getsentry/penguin
app/helpers/reports_helper.rb                                                                             @getsentry/foundation-analytics-stream
app/helpers/rules_analysis_helper.rb                                                                      @getsentry/fang @getsentry/libretto
app/helpers/rules_helper.rb                                                                               @getsentry/fang @getsentry/views-core @getsentry/views-enablement @getsentry/libretto
app/helpers/satisfaction_ratings_helper.rb                                                                @getsentry/fang
app/helpers/settings/email_helper.rb                                                                      @getsentry/strongbad
app/helpers/settings/security_helper.rb                                                                   @getsentry/secdev @getsentry/unagi
app/helpers/settings/slas_helper.rb                                                                       @getsentry/fang
app/helpers/sharing/agreements_helper.rb                                                                  @getsentry/boxoffice @getsentry/popcorn
app/helpers/suspended_tickets_helper.rb                                                                   @getsentry/strongbad
app/helpers/tags_helper.rb                                                                                @getsentry/boxoffice @getsentry/popcorn
app/helpers/targets_helper.rb                                                                             @getsentry/vegemite
app/helpers/ticket_trace_helper.rb                                                                        @getsentry/boxoffice @getsentry/popcorn
app/helpers/tickets_helper.rb                                                                             @getsentry/boxoffice @getsentry/popcorn
app/helpers/triggers_helper.rb                                                                            @getsentry/libretto
app/helpers/user_identities_helper.rb                                                                     @getsentry/bilby
app/helpers/user_interface_helper.rb                                                                      @getsentry/bilby
app/helpers/users_helper.rb                                                                               @getsentry/bilby
app/helpers/voice*                                                                                        @getsentry/voice
app/helpers/voice/                                                                                        @getsentry/voice
app/helpers/workspaces_helper.rb                                                                          @getsentry/kingfisher
app/mailers/                                                                                              @getsentry/strongbad
app/mailers/deflection_mailer.rb                                                                          @getsentry/waratah @getsentry/strongbad
app/mailers/old_deflection_mailer.rb                                                                      @getsentry/waratah @getsentry/strongbad
app/mailers/re_engagement_mailer.rb                                                                       @getsentry/woodstock
app/mailers/security_notifications/user_identity_changed.rb                                               @getsentry/strongbad @getsentry/bilby
app/mailers/security_notifications/user_profile_changed.rb                                                @getsentry/strongbad @getsentry/bilby
app/mailers/users_mailer.rb                                                                               @getsentry/strongbad @getsentry/bilby
app/middleware/                                                                                           @getsentry/classic-core-cph
app/middleware/account_rate_limit_middleware.rb                                                           @getsentry/capacity-planning @getsentry/bolt
app/middleware/api_rate_limited_middleware.rb                                                             @getsentry/bolt
app/middleware/billing/                                                                                   @getsentry/narwhals @getsentry/otters
app/middleware/concurrency_limiter_middleware.rb                                                          @getsentry/bolt
app/middleware/conditional_rate_limit_middleware.rb                                                       @getsentry/bolt
app/middleware/datadog_middleware.rb                                                                      @getsentry/squonk
app/middleware/http_method_not_allowed_middleware.rb                                                      @getsentry/bolt
app/middleware/invalid_api_request_handler.rb                                                             @getsentry/bolt
app/middleware/invalid_params_handler.rb                                                                  @getsentry/bolt
app/middleware/ip_whitelist_middleware.rb                                                                 @getsentry/bolt
app/middleware/limiter_middleware.rb                                                                      @getsentry/bolt
app/middleware/mapped_database_exceptions_middleware.rb                                                   @getsentry/bolt
app/middleware/middleware_tracing_middleware.rb                                                           @getsentry/bolt @getsentry/squonk @getsentry/classic-core-cph
app/middleware/mobile_sdk_api_redirector.rb                                                               @getsentry/lir
app/middleware/rule_routing_middleware.rb                                                                 @getsentry/fang @getsentry/views-core @getsentry/views-enablement @getsentry/libretto
app/middleware/system_instrumentation_middleware.rb                                                       @getsentry/bolt
app/middleware/web_portal_redirect_middleware.rb                                                          @getsentry/classic-core-cph
app/models/access.rb                                                                                      @getsentry/firefly
app/models/access/                                                                                        @getsentry/firefly
app/models/access/external_permissions/                                                                   @getsentry/firefly
app/models/access/organization_membership_common.rb                                                       @getsentry/bilby @getsentry/kowari
app/models/access/permissions/group_permission.rb                                                         @getsentry/bilby @getsentry/firefly @getsentry/bolt
app/models/access/permissions/membership_permission.rb                                                    @getsentry/bilby @getsentry/firefly @getsentry/bolt
app/models/access/permissions/organization_membership_permission.rb                                       @getsentry/bilby @getsentry/firefly @getsentry/kowari
app/models/access/permissions/organization_permission.rb                                                  @getsentry/kowari @getsentry/firefly
app/models/access/permissions/rule.rb                                                                     @getsentry/fang @getsentry/libretto
app/models/access/permissions/rule/                                                                       @getsentry/fang @getsentry/libretto
app/models/access/permissions/rule/automation_permission.rb                                               @getsentry/libretto
app/models/access/permissions/rule/macro_permission.rb                                                    @getsentry/fang
app/models/access/permissions/rule/rule_category_permission.rb                                            @getsentry/libretto
app/models/access/permissions/rule/trigger_permission.rb                                                  @getsentry/libretto
app/models/access/permissions/rule/user_view_permission.rb                                                @getsentry/penguin
app/models/access/permissions/rule/view_permission.rb                                                     @getsentry/fang
app/models/access/permissions/user_permission.rb                                                          @getsentry/bilby @getsentry/firefly @getsentry/bolt
app/models/access/policies/attachment_policy.rb                                                           @getsentry/squonk
app/models/access/policies/group_policy.rb                                                                @getsentry/bilby @getsentry/firefly @getsentry/bolt
app/models/access/policies/membership_policy.rb                                                           @getsentry/bilby @getsentry/firefly @getsentry/bolt
app/models/access/policies/organization_membership_policy.rb                                              @getsentry/bilby @getsentry/firefly @getsentry/kowari
app/models/access/policies/organization_policy.rb                                                         @getsentry/kowari @getsentry/firefly
app/models/access/policies/rule_policy.rb                                                                 @getsentry/fang @getsentry/libretto
app/models/access/policies/user_policy.rb                                                                 @getsentry/bilby @getsentry/firefly @getsentry/bolt
app/models/access/user_common.rb                                                                          @getsentry/bilby @getsentry/firefly @getsentry/bolt
app/models/access/validations/ticket_validator.rb                                                         @getsentry/boxoffice @getsentry/popcorn
app/models/account/account_mail.rb                                                                        @getsentry/strongbad
app/models/account/active_triggers_caching.rb                                                             @getsentry/libretto
app/models/account/agent_workspace_support.rb                                                             @getsentry/iris
app/models/account/billable_agents.rb                                                                     @getsentry/narwhals @getsentry/otters
app/models/account/canceller.rb                                                                           @getsentry/belugas
app/models/account/capability/polaris_compatible.rb                                                       @getsentry/iris
app/models/account/certificate_support.rb                                                                 @getsentry/secdev
app/models/account/chat_support.rb                                                                        @getsentry/bilby
app/models/account/cms_support.rb                                                                         @getsentry/athene
app/models/account/creation.rb                                                                            @getsentry/bilby
app/models/account/crm_integration.rb                                                                     @getsentry/platycorn
app/models/account/custom_fields.rb                                                                       @getsentry/boxoffice @getsentry/popcorn @getsentry/vinyl
app/models/account/custom_statuses.rb                                                                     @getsentry/boxoffice @getsentry/popcorn
app/models/account/customer_satisfaction_support.rb                                                       @getsentry/fang
app/models/account/explore_support.rb                                                                     @getsentry/kepler
app/models/account/fraud_support.rb                                                                       @getsentry/orca
app/models/account/malware_whitelist.rb                                                                   @getsentry/strongbad
app/models/account/multiproduct_billable_agents.rb                                                        @getsentry/lyrebird
app/models/account/multiproduct_support.rb                                                                @getsentry/narwhals @getsentry/otters
app/models/account/onboarding_support.rb                                                                  @getsentry/ponderosa
app/models/account/route_support.rb                                                                       @getsentry/boxoffice @getsentry/popcorn @getsentry/piratos
app/models/account/sandbox_support.rb                                                                     @getsentry/ngiyari @getsentry/pcc-operations
app/models/account/security_feature_support.rb                                                            @getsentry/secdev
app/models/account/side_conversations_support.rb                                                          @getsentry/collaboration
app/models/account/spam_sensitivity.rb                                                                    @getsentry/strongbad @getsentry/orca
app/models/account/suite_support.rb                                                                       @getsentry/narwhals @getsentry/otters
app/models/account/suspension.rb                                                                          @getsentry/narwhals @getsentry/otters
app/models/account/ticket_field_caching.rb                                                                @getsentry/boxoffice @getsentry/popcorn
app/models/account/ticket_sharing_support.rb                                                              @getsentry/boxoffice @getsentry/popcorn
app/models/account/voice*                                                                                 @getsentry/voice
app/models/account/web_widget_support.rb                                                                  @getsentry/copperhead
app/models/account_move.rb                                                                                @getsentry/exodus @getsentry/sunburst
app/models/account_service_subscription.rb                                                                @getsentry/narwhals @getsentry/otters
app/models/accounts/precreation.rb                                                                        @getsentry/narwhals @getsentry/otters
app/models/accounts/sandbox.rb                                                                            @getsentry/ngiyari @getsentry/pcc-operations
app/models/accounts/shell_account_activation.rb                                                           @getsentry/rakali
app/models/acme_authorization.rb                                                                          @getsentry/secdev
app/models/acme_certificate.rb                                                                            @getsentry/secdev
app/models/acme_certificate_job_status.rb                                                                 @getsentry/secdev
app/models/acme_registration.rb                                                                           @getsentry/secdev
app/models/agent_downgrade_audit.rb                                                                       @getsentry/narwhals @getsentry/otters
app/models/answer_bot/                                                                                    @getsentry/answer-bot
app/models/apps/chat_app_installation.rb                                                                  @getsentry/iris
app/models/attachment.rb                                                                                  @getsentry/squonk
app/models/brand.rb                                                                                       @getsentry/boxoffice @getsentry/popcorn
app/models/brand/help_center_support.rb                                                                   @getsentry/guide-dev
app/models/certificate.rb                                                                                 @getsentry/secdev
app/models/certificate_authorities.rb                                                                     @getsentry/secdev
app/models/certificate_ip.rb                                                                              @getsentry/secdev
app/models/chat_transcript.rb                                                                             @getsentry/teapot @getsentry/tealeaves
app/models/chat_transcript/                                                                               @getsentry/teapot @getsentry/tealeaves
app/models/cms/table_field.rb                                                                             @getsentry/athene
app/models/cms/text.rb                                                                                    @getsentry/athene
app/models/cms/variant.rb                                                                                 @getsentry/athene
app/models/collaboration.rb                                                                               @getsentry/strongbad
app/models/collaboration/                                                                                 @getsentry/strongbad
app/models/compliance_deletion_feedback.rb                                                                @getsentry/spyglass
app/models/compliance_deletion_status.rb                                                                  @getsentry/spyglass
app/models/compliance_move.rb                                                                             @getsentry/productivity-deploy
app/models/concerns/chat_phase_three.rb                                                                   @getsentry/bolt
app/models/concerns/field_creation_statsd_metrics.rb                                                      @getsentry/vinyl
app/models/concerns/lookup_field_source.rb                                                                @getsentry/vinyl
app/models/concerns/raw_http.rb                                                                           @getsentry/vegemite
app/models/concerns/relationship_field_validation.rb                                                      @getsentry/vinyl
app/models/concerns/relationship_field_value_validation.rb                                                @getsentry/vinyl
app/models/concerns/tde_workspace.rb                                                                      @getsentry/kingfisher
app/models/concerns/trial_limit.rb                                                                        @getsentry/space-dogs
app/models/credit_card.rb                                                                                 @getsentry/narwhals @getsentry/otters
app/models/custom_field/                                                                                  @getsentry/boxoffice @getsentry/popcorn @getsentry/vinyl
app/models/custom_field/dropdown_choice/attribute_change_creator.rb                                       @getsentry/kowari @getsentry/vinyl
app/models/custom_field_option.rb                                                                         @getsentry/boxoffice @getsentry/popcorn @getsentry/vinyl
app/models/custom_object.rb                                                                               @getsentry/vinyl
app/models/custom_object_record.rb                                                                        @getsentry/vinyl
app/models/custom_object_value.rb                                                                         @getsentry/vinyl
app/models/custom_security_policy.rb                                                                      @getsentry/secdev
app/models/custom_status.rb                                                                               @getsentry/boxoffice @getsentry/popcorn
app/models/data_deletion_audit.rb                                                                         @getsentry/account-data-deletion
app/models/data_deletion_audit_job.rb                                                                     @getsentry/account-data-deletion
app/models/email_fb_integration.rb                                                                        @getsentry/strongbad
app/models/esc_kafka_message.rb                                                                           @getsentry/ticket-platform @getsentry/goanna
app/models/events/agent_macro_reference.rb                                                                @getsentry/fang
app/models/events/answer_bot_notification.rb                                                              @getsentry/waratah
app/models/events/associate_att_vals_event.rb                                                             @getsentry/argonauts
app/models/events/audit.rb                                                                                @getsentry/fang @getsentry/libretto
app/models/events/audit_event.rb                                                                          @getsentry/ticket-platform
app/models/events/automatic_answer_reject.rb                                                              @getsentry/waratah
app/models/events/automatic_answer_send.rb                                                                @getsentry/waratah
app/models/events/automatic_answer_solve.rb                                                               @getsentry/waratah
app/models/events/automatic_answer_viewed.rb                                                              @getsentry/waratah
app/models/events/base_ticket_sharing_event.rb                                                            @getsentry/boxoffice @getsentry/popcorn
app/models/events/cc.rb                                                                                   @getsentry/strongbad
app/models/events/change.rb                                                                               @getsentry/ticket-platform
app/models/events/channel_back_event.rb                                                                   @getsentry/ocean
app/models/events/channel_back_failed_event.rb                                                            @getsentry/ocean
app/models/events/chat*                                                                                   @getsentry/teapot @getsentry/tealeaves
app/models/events/chat_file_redaction_event.rb                                                            @getsentry/orchid
app/models/events/chat_message_redact_event.rb                                                            @getsentry/orchid
app/models/events/collab_thread_closed.rb                                                                 @getsentry/collaboration
app/models/events/collab_thread_created.rb                                                                @getsentry/collaboration
app/models/events/collab_thread_event.rb                                                                  @getsentry/collaboration
app/models/events/collab_thread_reopened.rb                                                               @getsentry/collaboration
app/models/events/collab_thread_reply.rb                                                                  @getsentry/collaboration
app/models/events/collab_thread_via_trigger.rb                                                            @getsentry/collaboration
app/models/events/collaboration_change.rb                                                                 @getsentry/strongbad
app/models/events/comment.rb                                                                              @getsentry/ticket-platform
app/models/events/create.rb                                                                               @getsentry/ticket-platform
app/models/events/email_cc_change.rb                                                                      @getsentry/strongbad
app/models/events/event.rb                                                                                @getsentry/ticket-platform
app/models/events/external.rb                                                                             @getsentry/vegemite
app/models/events/facebook_comment.rb                                                                     @getsentry/ocean
app/models/events/facebook_event.rb                                                                       @getsentry/ocean
app/models/events/follower_change.rb                                                                      @getsentry/strongbad
app/models/events/follower_notification.rb                                                                @getsentry/strongbad
app/models/events/knowledge_captured.rb                                                                   @getsentry/waratah
app/models/events/knowledge_flagged.rb                                                                    @getsentry/waratah
app/models/events/knowledge_link_accepted.rb                                                              @getsentry/waratah
app/models/events/knowledge_link_rejected.rb                                                              @getsentry/waratah
app/models/events/knowledge_linked.rb                                                                     @getsentry/waratah
app/models/events/macro_reference.rb                                                                      @getsentry/fang
app/models/events/messaging_csat_event.rb                                                                 @getsentry/teapot @getsentry/tealeaves
app/models/events/messaging_event.rb                                                                      @getsentry/snoop
app/models/events/notification_with_ccs.rb                                                                @getsentry/strongbad
app/models/events/re_engagement_sent.rb                                                                   @getsentry/woodstock
app/models/events/satisfaction_rating_event.rb                                                            @getsentry/fang
app/models/events/schedule_assignment.rb                                                                  @getsentry/fang
app/models/events/sla_target_change.rb                                                                    @getsentry/fang
app/models/events/slack_event.rb                                                                          @getsentry/pegasus
app/models/events/sms_notification.rb                                                                     @getsentry/voice
app/models/events/suspended_ticket_recovery.rb                                                            @getsentry/strongbad
app/models/events/ticket_notifier.rb                                                                      @getsentry/strongbad
app/models/events/ticket_sharing_event.rb                                                                 @getsentry/boxoffice @getsentry/popcorn
app/models/events/ticket_unshare_event.rb                                                                 @getsentry/boxoffice @getsentry/popcorn
app/models/events/tweet.rb                                                                                @getsentry/ocean
app/models/events/twitter_dm_event.rb                                                                     @getsentry/ocean
app/models/events/twitter_event.rb                                                                        @getsentry/ocean
app/models/events/user_custom_field_event.rb                                                              @getsentry/bilby @getsentry/vinyl @getsentry/libretto
app/models/events/voice*                                                                                  @getsentry/voice
app/models/events/voice_comment/                                                                          @getsentry/voice
app/models/events/webhook_event.rb                                                                        @getsentry/vegemite
app/models/events/workspace_changed.rb                                                                    @getsentry/kingfisher
app/models/experiment.rb                                                                                  @getsentry/minerva
app/models/expirable_attachment.rb                                                                        @getsentry/squonk
app/models/explore/subscription.rb                                                                        @getsentry/narwhals @getsentry/otters
app/models/external_email_credential.rb                                                                   @getsentry/strongbad
app/models/external_ticket_datas/salesforce_ticket_data.rb                                                @getsentry/platycorn
app/models/external_user_datas/                                                                           @getsentry/platycorn @getsentry/bilby
app/models/fraud_score.rb                                                                                 @getsentry/orca
app/models/group.rb                                                                                       @getsentry/bolt @getsentry/teapot @getsentry/tealeaves
app/models/group/settings.rb                                                                              @getsentry/bolt @getsentry/teapot @getsentry/tealeaves
app/models/group_macro.rb                                                                                 @getsentry/fang
app/models/group_view.rb                                                                                  @getsentry/fang
app/models/guide/                                                                                         @getsentry/guide-dev
app/models/guide/subscription.rb                                                                          @getsentry/narwhals @getsentry/otters
app/models/guide/subscription/previewer.rb                                                                @getsentry/narwhals @getsentry/otters
app/models/health/diagnostic/account_fraud_service_diagnostic.rb                                          @getsentry/orca
app/models/health/diagnostic/deco_diagnostic.rb                                                           @getsentry/argonauts
app/models/health/diagnostic/search_diagnostic.rb                                                         @getsentry/search
app/models/health/diagnostic/staff_service_diagnostic.rb                                                  @getsentry/space-dogs
app/models/health/diagnostic/tessa_diagnostic.rb                                                          @getsentry/harrier
app/models/health/diagnostic/voyager_diagnostic.rb                                                        @getsentry/views-enablement
app/models/health/diagnostic/zendesk_archive_riak_kv_diagnostic.rb                                        @getsentry/ticket-platform
app/models/help_center.rb                                                                                 @getsentry/guide-dev
app/models/help_center_state_changer.rb                                                                   @getsentry/guide-dev
app/models/inbound_email.rb                                                                               @getsentry/strongbad
app/models/inbound_mail_rate_limit.rb                                                                     @getsentry/strongbad
app/models/instance_value.rb                                                                              @getsentry/argonauts
app/models/invoice.rb                                                                                     @getsentry/narwhals @getsentry/otters
app/models/jetpack_task.rb                                                                                @getsentry/ponderosa
app/models/jetpack_task_list.rb                                                                           @getsentry/ponderosa
app/models/jira_issue.rb                                                                                  @getsentry/pegasus
app/models/jobs/account_agent_workspace_auto_activation_job.rb                                            @getsentry/iris
app/models/jobs/account_automation_parallel_execution_job.rb                                              @getsentry/libretto
app/models/jobs/account_automations_job.rb                                                                @getsentry/libretto
app/models/jobs/account_cancellation_job.rb                                                               @getsentry/belugas
app/models/jobs/account_product_feature_sync_job.rb                                                       @getsentry/collaboration
app/models/jobs/account_synchronizer_job.rb                                                               @getsentry/narwhals @getsentry/otters
app/models/jobs/accounts_after_conversion_job.rb                                                          @getsentry/rakali
app/models/jobs/accounts_precreation_job.rb                                                               @getsentry/rakali
app/models/jobs/accounts_reminder_job.rb                                                                  @getsentry/rakali
app/models/jobs/acme_certificate_job.rb                                                                   @getsentry/secdev
app/models/jobs/add_all_agents_to_default_group_job.rb                                                    @getsentry/bolt
app/models/jobs/agent_workspace_activation_job.rb                                                         @getsentry/snoop
app/models/jobs/align_user_time_zones_job.rb                                                              @getsentry/bilby
app/models/jobs/answer_bot/                                                                               @getsentry/waratah
app/models/jobs/answer_bot/ticket_deflection_tagging_job.rb                                               @getsentry/waratah
app/models/jobs/apply_macros_job.rb                                                                       @getsentry/fang
app/models/jobs/archive/                                                                                  @getsentry/ticket-platform
app/models/jobs/audit_logs_export_job.rb                                                                  @getsentry/audit-log
app/models/jobs/base_export_job.rb                                                                        @getsentry/foundation-analytics-stream
app/models/jobs/batch_update_job.rb                                                                       @getsentry/bolt
app/models/jobs/billing_related_user_data_job.rb                                                          @getsentry/narwhals @getsentry/otters
app/models/jobs/bulk_create_job.rb                                                                        @getsentry/bolt
app/models/jobs/bulk_delete_job.rb                                                                        @getsentry/bolt
app/models/jobs/bulk_job.rb                                                                               @getsentry/bolt
app/models/jobs/ccs_and_followers/                                                                        @getsentry/strongbad
app/models/jobs/chat_app_installation_job.rb                                                              @getsentry/fangorn
app/models/jobs/chat_phase_three/entitlement_sync_job.rb                                                  @getsentry/space-dogs
app/models/jobs/chat_store_redaction_job.rb                                                               @getsentry/teapot @getsentry/tealeaves
app/models/jobs/collection_resources_create_job.rb                                                        @getsentry/dingo
app/models/jobs/collection_resources_delete_job.rb                                                        @getsentry/dingo
app/models/jobs/collection_resources_update_job.rb                                                        @getsentry/dingo
app/models/jobs/crm_data_bulk_delete_job.rb                                                               @getsentry/platycorn
app/models/jobs/csat_csv_job.rb                                                                           @getsentry/fang
app/models/jobs/csv_job.rb                                                                                @getsentry/foundation-analytics-stream
app/models/jobs/custom_field_deletion_job.rb                                                              @getsentry/vinyl
app/models/jobs/dangerous_congestion_test_job.rb                                                          @getsentry/bolt
app/models/jobs/downcase_subdomains_job.rb                                                                @getsentry/quoll
app/models/jobs/downgrade_agent_groups_access_job.rb                                                      @getsentry/bolt @getsentry/bilby
app/models/jobs/downgrade_organizations_access_job.rb                                                     @getsentry/bilby @getsentry/kowari
app/models/jobs/durable.rb                                                                                @getsentry/bolt
app/models/jobs/dynamo_db_manual_migration_job.rb                                                         @getsentry/ticket-platform
app/models/jobs/embeddable_chat_widget_enabler_job.rb                                                     @getsentry/emu
app/models/jobs/fetch_google_profile_image_job.rb                                                         @getsentry/bilby
app/models/jobs/fetch_profile_image_job.rb                                                                @getsentry/bilby
app/models/jobs/fraud_score_job.rb                                                                        @getsentry/orca
app/models/jobs/gooddata_configuration_job.rb                                                             @getsentry/waratah
app/models/jobs/gooddata_enable_job.rb                                                                    @getsentry/waratah
app/models/jobs/gooddata_full_reload_job.rb                                                               @getsentry/foundation-analytics-stream
app/models/jobs/gooddata_integrations_destroy_job.rb                                                      @getsentry/waratah
app/models/jobs/gooddata_integrations_job.rb                                                              @getsentry/waratah
app/models/jobs/gooddata_user_create_job.rb                                                               @getsentry/waratah
app/models/jobs/gooddata_user_destroy_job.rb                                                              @getsentry/waratah
app/models/jobs/gooddata_user_reprovisioning_job.rb                                                       @getsentry/waratah
app/models/jobs/gooddata_user_sync_job.rb                                                                 @getsentry/waratah
app/models/jobs/group_delete_job.rb                                                                       @getsentry/bolt
app/models/jobs/group_membership_bulk_create_job.rb                                                       @getsentry/bolt
app/models/jobs/group_membership_bulk_delete_job.rb                                                       @getsentry/bolt
app/models/jobs/import/                                                                                   @getsentry/bilby
app/models/jobs/invoice_email_update_job.rb                                                               @getsentry/billing
app/models/jobs/job_with_status.rb                                                                        @getsentry/bolt
app/models/jobs/locale_bulk_update_job.rb                                                                 @getsentry/bilby @getsentry/boxoffice @getsentry/popcorn
app/models/jobs/logout_all_mobile_devices_job.rb                                                          @getsentry/secdev
app/models/jobs/mail_rendering_job.rb                                                                     @getsentry/strongbad
app/models/jobs/mail_rendering_job/account_detection.rb                                                   @getsentry/strongbad
app/models/jobs/mail_rendering_job/deferred.rb                                                            @getsentry/strongbad
app/models/jobs/malware_scan_consumer_retry_job.rb                                                        @getsentry/spyglass
app/models/jobs/messaging_csat_request_job.rb                                                             @getsentry/teapot @getsentry/tealeaves
app/models/jobs/omnichannel/                                                                              @getsentry/bilby @getsentry/rakali
app/models/jobs/open_tickets_on_hold_job.rb                                                               @getsentry/boxoffice @getsentry/popcorn
app/models/jobs/organization_batch_update_job.rb                                                          @getsentry/kowari
app/models/jobs/organization_bulk_create_job.rb                                                           @getsentry/kowari
app/models/jobs/organization_bulk_create_job_v3.rb                                                        @getsentry/kowari @getsentry/bolt
app/models/jobs/organization_bulk_delete_job.rb                                                           @getsentry/kowari
app/models/jobs/organization_bulk_update_job.rb                                                           @getsentry/kowari
app/models/jobs/organization_membership_bulk_create_job.rb                                                @getsentry/kowari
app/models/jobs/organization_membership_bulk_delete_job.rb                                                @getsentry/kowari
app/models/jobs/organization_reassign_job.rb                                                              @getsentry/kowari
app/models/jobs/organization_reassign_v2_job.rb                                                           @getsentry/kowari
app/models/jobs/organization_unset_job.rb                                                                 @getsentry/kowari
app/models/jobs/permissions_policy_sync_job.rb                                                            @getsentry/space-dogs
app/models/jobs/persist_feature_bits_job.rb                                                               @getsentry/billing
app/models/jobs/push_notification*                                                                        @getsentry/lir
app/models/jobs/re_encrypt_external_email_credential_job.rb                                               @getsentry/strongbad
app/models/jobs/re_encrypt_target_credentials_job.rb                                                      @getsentry/vegemite
app/models/jobs/record_counter_job.rb                                                                     @getsentry/boxoffice @getsentry/popcorn @getsentry/bilby
app/models/jobs/recover_false_positive_suspended_ticket_job.rb                                            @getsentry/orca
app/models/jobs/redaction/email_redaction_job.rb                                                          @getsentry/orchid
app/models/jobs/remove_regular_organization_memberships_job.rb                                            @getsentry/bilby @getsentry/kowari
app/models/jobs/report_job.rb                                                                             @getsentry/foundation-analytics-stream
app/models/jobs/reset_end_users_locale_job.rb                                                             @getsentry/bilby
app/models/jobs/restore_default_content_job.rb                                                            @getsentry/i18n
app/models/jobs/revere_account_update_job.rb                                                              @getsentry/sunburst
app/models/jobs/revere_subscriber_update_job.rb                                                           @getsentry/sunburst
app/models/jobs/revoke_external_email_credential_job.rb                                                   @getsentry/strongbad
app/models/jobs/rollup_backlog_job.rb                                                                     @getsentry/foundation-analytics-stream
app/models/jobs/routing_attribute_value_delete_job.rb                                                     @getsentry/argonauts
app/models/jobs/rspamd_feedback_job.rb                                                                    @getsentry/strongbad
app/models/jobs/rule_preview_ticket_count_job.rb                                                          @getsentry/fang
app/models/jobs/rule_ticket_count_job.rb                                                                  @getsentry/views-core @getsentry/views-enablement
app/models/jobs/salesforce_*                                                                              @getsentry/platycorn
app/models/jobs/sandbox_initializer_job.rb                                                                @getsentry/ngiyari @getsentry/pcc-operations
app/models/jobs/set_agent_workspace_availability_job.rb                                                   @getsentry/teapot @getsentry/tealeaves
app/models/jobs/set_user_locale_job.rb                                                                    @getsentry/lir @getsentry/bilby
app/models/jobs/shared_ticket_bulk_delete_job.rb                                                          @getsentry/boxoffice @getsentry/popcorn
app/models/jobs/shell_owner_welcome_email_job.rb                                                          @getsentry/space-dogs
app/models/jobs/side_conversation_job.rb                                                                  @getsentry/collaboration
app/models/jobs/simplified_email_threading/                                                               @getsentry/strongbad
app/models/jobs/sla_badge_fixer_on_ticket_close_job.rb                                                    @getsentry/fang
app/models/jobs/slack_job.rb                                                                              @getsentry/pegasus
app/models/jobs/sms/                                                                                      @getsentry/voice
app/models/jobs/solve_incidents_job.rb                                                                    @getsentry/boxoffice @getsentry/popcorn
app/models/jobs/spam_cleanup_job.rb                                                                       @getsentry/orca
app/models/jobs/stores_synchronization_job.rb                                                             @getsentry/squonk
app/models/jobs/sugar_crm_sync_job.rb                                                                     @getsentry/platycorn
app/models/jobs/suite_trial_job.rb                                                                        @getsentry/rakali
app/models/jobs/support_creation_job.rb                                                                   @getsentry/rakali
app/models/jobs/support_product_creation_job.rb                                                           @getsentry/bilby
app/models/jobs/survey_persistence_job.rb                                                                 @getsentry/belugas
app/models/jobs/suspended_tickets_bulk_recovery_job.rb                                                    @getsentry/strongbad
app/models/jobs/sync_chat_agent_avatar_job.rb                                                             @getsentry/polo
app/models/jobs/tag_bulk_update_job.rb                                                                    @getsentry/boxoffice @getsentry/popcorn
app/models/jobs/target_job.rb                                                                             @getsentry/vegemite
app/models/jobs/terminate_all_sessions_job.rb                                                             @getsentry/secdev
app/models/jobs/throttle_job.rb                                                                           @getsentry/foundation-analytics-stream
app/models/jobs/ticket_attribute_values_setter_job.rb                                                     @getsentry/argonauts
app/models/jobs/ticket_batch_update_job.rb                                                                @getsentry/boxoffice @getsentry/popcorn
app/models/jobs/ticket_brand_reassign_job.rb                                                              @getsentry/boxoffice @getsentry/popcorn
app/models/jobs/ticket_bulk_create_job.rb                                                                 @getsentry/boxoffice @getsentry/popcorn
app/models/jobs/ticket_bulk_import_job.rb                                                                 @getsentry/boxoffice @getsentry/popcorn
app/models/jobs/ticket_bulk_update_job.rb                                                                 @getsentry/boxoffice @getsentry/popcorn
app/models/jobs/ticket_deflection_job.rb                                                                  @getsentry/waratah
app/models/jobs/ticket_field_entry_delete_job.rb                                                          @getsentry/boxoffice @getsentry/popcorn
app/models/jobs/ticket_merge_job.rb                                                                       @getsentry/boxoffice @getsentry/popcorn
app/models/jobs/ticket_metric_breach_check_job.rb                                                         @getsentry/fang
app/models/jobs/ticket_sharing_support_addresses_job.rb                                                   @getsentry/boxoffice @getsentry/popcorn
app/models/jobs/trial_extras_job.rb                                                                       @getsentry/quoll
app/models/jobs/trigger_cleanup_job.rb                                                                    @getsentry/libretto
app/models/jobs/two_factor_csv_job.rb                                                                     @getsentry/secdev
app/models/jobs/unassign_tickets_job.rb                                                                   @getsentry/boxoffice @getsentry/popcorn
app/models/jobs/update_apps_feature_job.rb                                                                @getsentry/wattle @getsentry/dingo
app/models/jobs/update_group_privacy_in_tickets_job.rb                                                    @getsentry/boxoffice @getsentry/popcorn
app/models/jobs/update_help_center_state_job.rb                                                           @getsentry/guide-dev
app/models/jobs/user_batch_update_job.rb                                                                  @getsentry/bilby
app/models/jobs/user_bulk_create_job.rb                                                                   @getsentry/bilby
app/models/jobs/user_bulk_create_job_v3.rb                                                                @getsentry/bilby @getsentry/bolt
app/models/jobs/user_bulk_delete_job.rb                                                                   @getsentry/bilby
app/models/jobs/user_bulk_update_job.rb                                                                   @getsentry/bilby
app/models/jobs/user_bulk_update_job_v2.rb                                                                @getsentry/bilby
app/models/jobs/user_entity_account_move_job.rb                                                           @getsentry/piratos
app/models/jobs/user_entity_sync_job.rb                                                                   @getsentry/piratos
app/models/jobs/user_merge_job.rb                                                                         @getsentry/bilby
app/models/jobs/user_view_csv_job.rb                                                                      @getsentry/penguin
app/models/jobs/user_xml_export_job.rb                                                                    @getsentry/bilby
app/models/jobs/view_csv_job.rb                                                                           @getsentry/views-enablement
app/models/jobs/voice/                                                                                    @getsentry/voice
app/models/jobs/voice/usage_subscription_corrector_job.rb                                                 @getsentry/narwhals @getsentry/otters
app/models/jobs/webhook_job.rb                                                                            @getsentry/vegemite
app/models/jobs/xml_export_job.rb                                                                         @getsentry/foundation-analytics-stream
app/models/jobs/zopim/agent_sync_job.rb                                                                   @getsentry/billing
app/models/lotus/                                                                                         @getsentry/harrier
app/models/membership.rb                                                                                  @getsentry/bolt @getsentry/bilby
app/models/metric_event_policy_metric.rb                                                                  @getsentry/fang
app/models/mobile_sdk*                                                                                    @getsentry/lir
app/models/nil_subscription.rb                                                                            @getsentry/bilby
app/models/ola/                                                                                           @getsentry/fang
app/models/onboarding_task.rb                                                                             @getsentry/ponderosa
app/models/organization.rb                                                                                @getsentry/kowari
app/models/organization/                                                                                  @getsentry/kowari
app/models/organization_association_addition.rb                                                           @getsentry/kowari
app/models/organization_association_addition_v2.rb                                                        @getsentry/kowari
app/models/organization_association_removal.rb                                                            @getsentry/kowari
app/models/organization_domain.rb                                                                         @getsentry/kowari
app/models/organization_email.rb                                                                          @getsentry/kowari
app/models/organization_membership.rb                                                                     @getsentry/kowari
app/models/organizations/                                                                                 @getsentry/kowari
app/models/outbound/                                                                                      @getsentry/narwhals @getsentry/otters
app/models/outbound/plan.rb                                                                               @getsentry/narwhals @getsentry/otters
app/models/outbound/subscription.rb                                                                       @getsentry/narwhals @getsentry/otters
app/models/outbound/subscription_options.rb                                                               @getsentry/narwhals @getsentry/otters
app/models/outbound_email.rb                                                                              @getsentry/strongbad
app/models/outbound_email_recipient.rb                                                                    @getsentry/strongbad
app/models/payment.rb                                                                                     @getsentry/narwhals @getsentry/otters
app/models/permission_set.rb                                                                              @getsentry/space-dogs @getsentry/firefly
app/models/permission_set/                                                                                @getsentry/space-dogs @getsentry/firefly
app/models/push_notifications/                                                                            @getsentry/lir
app/models/queue_audit.rb                                                                                 @getsentry/bolt
app/models/recipient_address.rb                                                                           @getsentry/strongbad
app/models/recipient_addresses/                                                                           @getsentry/strongbad
app/models/redaction/                                                                                     @getsentry/orchid
app/models/relationship_field_index.rb                                                                    @getsentry/vinyl
app/models/remote_authentication.rb                                                                       @getsentry/unagi
app/models/resource_collection.rb                                                                         @getsentry/dingo
app/models/resource_collection_resource.rb                                                                @getsentry/dingo
app/models/reviewed_tweet.rb                                                                              @getsentry/ocean
app/models/route.rb                                                                                       @getsentry/boxoffice @getsentry/popcorn
app/models/routing/                                                                                       @getsentry/argonauts
app/models/rules/                                                                                         @getsentry/fang @getsentry/libretto
app/models/rules/automation.rb                                                                            @getsentry/libretto
app/models/rules/cached_rule_preview_ticket_count.rb                                                      @getsentry/views-core @getsentry/views-enablement
app/models/rules/cached_rule_ticket_count.rb                                                              @getsentry/views-core @getsentry/views-enablement
app/models/rules/macro.rb                                                                                 @getsentry/fang
app/models/rules/null_revision.rb                                                                         @getsentry/libretto
app/models/rules/rule.rb                                                                                  @getsentry/fang @getsentry/views-core @getsentry/views-enablement @getsentry/libretto
app/models/rules/rule_category.rb                                                                         @getsentry/libretto
app/models/rules/rule_dictionary.rb                                                                       @getsentry/fang @getsentry/views-core @getsentry/views-enablement @getsentry/libretto
app/models/rules/trigger*                                                                                 @getsentry/libretto
app/models/rules/user_view.rb                                                                             @getsentry/penguin
app/models/rules/view.rb                                                                                  @getsentry/views-core @getsentry/views-enablement
app/models/salesforce_integration.rb                                                                      @getsentry/platycorn
app/models/satisfaction/cached_score.rb                                                                   @getsentry/fang
app/models/satisfaction/calculations.rb                                                                   @getsentry/fang
app/models/satisfaction/prediction_survey.rb                                                              @getsentry/fang
app/models/satisfaction/rating.rb                                                                         @getsentry/fang
app/models/satisfaction/reason.rb                                                                         @getsentry/fang
app/models/satisfaction/reason_brand_restriction.rb                                                       @getsentry/fang
app/models/satisfaction_rating_intention.rb                                                               @getsentry/fang
app/models/sequences/nice_id_sequence.rb                                                                  @getsentry/ticket-platform
app/models/sequences/sequence.rb                                                                          @getsentry/ticket-platform
app/models/sharded_subscription.rb                                                                        @getsentry/narwhals @getsentry/otters
app/models/shared_ticket.rb                                                                               @getsentry/boxoffice @getsentry/popcorn
app/models/sharing.rb                                                                                     @getsentry/boxoffice @getsentry/popcorn
app/models/sharing/                                                                                       @getsentry/boxoffice @getsentry/popcorn
app/models/sharing/foreign_user_support.rb                                                                @getsentry/boxoffice @getsentry/popcorn @getsentry/bilby
app/models/simplified_email_opt_in_setting.rb                                                             @getsentry/strongbad
app/models/simplified_email_rule_body.rb                                                                  @getsentry/strongbad
app/models/skip.rb                                                                                        @getsentry/argonauts
app/models/sla/                                                                                           @getsentry/fang
app/models/stores_backfill_audit.rb                                                                       @getsentry/squonk
app/models/subscription.rb                                                                                @getsentry/narwhals @getsentry/otters
app/models/subscription/                                                                                  @getsentry/narwhals @getsentry/otters
app/models/subscription/plan_change_support.rb                                                            @getsentry/narwhals @getsentry/otters @getsentry/rakali
app/models/subscription/voice*                                                                            @getsentry/voice
app/models/subscription_feature_addon.rb                                                                  @getsentry/narwhals @getsentry/otters
app/models/suspended_ticket.rb                                                                            @getsentry/strongbad
app/models/suspended_ticket_notification.rb                                                               @getsentry/strongbad
app/models/targets/                                                                                       @getsentry/vegemite
app/models/targets/email_target.rb                                                                        @getsentry/strongbad
app/models/targets/jira_target.rb                                                                         @getsentry/vegemite @getsentry/pegasus
app/models/targets/salesforce_target.rb                                                                   @getsentry/platycorn
app/models/targets/twilio_target.rb                                                                       @getsentry/platycorn
app/models/ticket.rb                                                                                      @getsentry/boxoffice @getsentry/popcorn
app/models/ticket/archive.rb                                                                              @getsentry/support-ticket-archiving
app/models/ticket/collaborating.rb                                                                        @getsentry/strongbad
app/models/ticket/custom_status_synchronization.rb                                                        @getsentry/boxoffice @getsentry/popcorn
app/models/ticket/id_masking.rb                                                                           @getsentry/strongbad
app/models/ticket/integrity.rb                                                                            @getsentry/boxoffice @getsentry/popcorn
app/models/ticket/merging.rb                                                                              @getsentry/boxoffice @getsentry/popcorn
app/models/ticket/observers/chat_ticket_observer.rb                                                       @getsentry/teapot @getsentry/tealeaves
app/models/ticket/observers/sdk_ticket_activity_observer.rb                                               @getsentry/lir
app/models/ticket/observers/ticket_activity_observer.rb                                                   @getsentry/boxoffice @getsentry/popcorn
app/models/ticket/observers/ticket_event_bus_observer.rb                                                  @getsentry/ticket-platform
app/models/ticket/observers/ticket_metrics_observer.rb                                                    @getsentry/fang
app/models/ticket/observers/ticket_sla_observer.rb                                                        @getsentry/fang
app/models/ticket/remote_files.rb                                                                         @getsentry/strongbad
app/models/ticket/required_fields.rb                                                                      @getsentry/boxoffice @getsentry/popcorn
app/models/ticket/sharing.rb                                                                              @getsentry/boxoffice @getsentry/popcorn
app/models/ticket/ticket_field_entries.rb                                                                 @getsentry/boxoffice @getsentry/popcorn
app/models/ticket/ticket_satisfaction.rb                                                                  @getsentry/boxoffice @getsentry/popcorn
app/models/ticket/twicket.rb                                                                              @getsentry/boxoffice @getsentry/popcorn
app/models/ticket/validations.rb                                                                          @getsentry/boxoffice @getsentry/popcorn
app/models/ticket/voice_tickets.rb                                                                        @getsentry/voice
app/models/ticket_archive_disqualification.rb                                                             @getsentry/support-ticket-archiving
app/models/ticket_archive_stub.rb                                                                         @getsentry/support-ticket-archiving
app/models/ticket_deflection.rb                                                                           @getsentry/waratah
app/models/ticket_deflection_article.rb                                                                   @getsentry/waratah
app/models/ticket_field_condition.rb                                                                      @getsentry/boxoffice @getsentry/popcorn
app/models/ticket_fields/                                                                                 @getsentry/boxoffice @getsentry/popcorn @getsentry/vinyl
app/models/ticket_form.rb                                                                                 @getsentry/boxoffice @getsentry/popcorn
app/models/ticket_form/                                                                                   @getsentry/boxoffice @getsentry/popcorn
app/models/ticket_form_brand_restriction.rb                                                               @getsentry/boxoffice @getsentry/popcorn
app/models/ticket_form_field.rb                                                                           @getsentry/boxoffice @getsentry/popcorn
app/models/ticket_metric/                                                                                 @getsentry/fang
app/models/ticket_schedule.rb                                                                             @getsentry/fang
app/models/ticket_workspace.rb                                                                            @getsentry/kingfisher
app/models/tokens/                                                                                        @getsentry/secdev
app/models/tpe/subscription.rb                                                                            @getsentry/narwhals @getsentry/otters
app/models/unverified_ticket_creation.rb                                                                  @getsentry/boxoffice @getsentry/popcorn
app/models/user.rb                                                                                        @getsentry/bilby
app/models/user_any_channel_identity.rb                                                                   @getsentry/ocean @getsentry/bilby
app/models/user_contact_information.rb                                                                    @getsentry/bilby
app/models/user_email_identity.rb                                                                         @getsentry/strongbad @getsentry/bilby
app/models/user_facebook_identity.rb                                                                      @getsentry/bilby
app/models/user_foreign_identity.rb                                                                       @getsentry/bilby
app/models/user_identity.rb                                                                               @getsentry/bilby
app/models/user_messaging_identity.rb                                                                     @getsentry/teapot
app/models/user_phone_attribute.rb                                                                        @getsentry/voice @getsentry/bilby
app/models/user_phone_extension.rb                                                                        @getsentry/voice @getsentry/bilby
app/models/user_phone_number_identity.rb                                                                  @getsentry/voice @getsentry/bilby
app/models/user_sdk_identity.rb                                                                           @getsentry/lir @getsentry/bilby
app/models/user_seat.rb                                                                                   @getsentry/bilby @getsentry/voice
app/models/user_twitter_identity.rb                                                                       @getsentry/bilby
app/models/user_voice_forwarding_identity.rb                                                              @getsentry/voice @getsentry/bilby
app/models/users/                                                                                         @getsentry/bilby
app/models/users/access.rb                                                                                @getsentry/bilby
app/models/users/agent_display_name.rb                                                                    @getsentry/bilby
app/models/users/answer_bot.rb                                                                            @getsentry/answer-bot @getsentry/bilby
app/models/users/authentication.rb                                                                        @getsentry/secdev @getsentry/bilby @getsentry/unagi
app/models/users/chat_agent_support.rb                                                                    @getsentry/bilby
app/models/users/chat_support.rb                                                                          @getsentry/bilby
app/models/users/crm.rb                                                                                   @getsentry/platycorn @getsentry/bilby
app/models/users/deletion.rb                                                                              @getsentry/spyglass @getsentry/bilby
app/models/users/deprecation.rb                                                                           @getsentry/bilby
app/models/users/group_memberships.rb                                                                     @getsentry/bolt
app/models/users/identification.rb                                                                        @getsentry/bilby
app/models/users/invalid_state.rb                                                                         @getsentry/secdev @getsentry/bilby
app/models/users/liquid.rb                                                                                @getsentry/bilby
app/models/users/localization.rb                                                                          @getsentry/bilby @getsentry/i18n
app/models/users/merge.rb                                                                                 @getsentry/bilby
app/models/users/naming.rb                                                                                @getsentry/bilby @getsentry/strongbad
app/models/users/observers/                                                                               @getsentry/bilby
app/models/users/observers/user_entity_observer.rb                                                        @getsentry/piratos @getsentry/bilby
app/models/users/onboarding_support.rb                                                                    @getsentry/ponderosa @getsentry/bilby
app/models/users/organization_memberships.rb                                                              @getsentry/bilby @getsentry/kowari
app/models/users/other_product_entitlements.rb                                                            @getsentry/bilby
app/models/users/password.rb                                                                              @getsentry/secdev @getsentry/bilby
app/models/users/password_changes.rb                                                                      @getsentry/secdev @getsentry/bilby
app/models/users/password_invalid.rb                                                                      @getsentry/secdev @getsentry/bilby
app/models/users/phone_number.rb                                                                          @getsentry/voice @getsentry/bilby
app/models/users/phone_number_behavior.rb                                                                 @getsentry/voice @getsentry/bilby
app/models/users/phone_number_validator.rb                                                                @getsentry/voice @getsentry/bilby
app/models/users/photo.rb                                                                                 @getsentry/bilby
app/models/users/properties.rb                                                                            @getsentry/bilby
app/models/users/role_mapping.rb                                                                          @getsentry/space-dogs @getsentry/bilby @getsentry/firefly
app/models/users/roles.rb                                                                                 @getsentry/space-dogs @getsentry/bilby @getsentry/firefly
app/models/users/signature.rb                                                                             @getsentry/bilby
app/models/users/suite_agent_support.rb                                                                   @getsentry/bilby
app/models/users/suspension.rb                                                                            @getsentry/bilby
app/models/users/tags.rb                                                                                  @getsentry/bilby
app/models/users/ticket_sharing_support.rb                                                                @getsentry/boxoffice @getsentry/popcorn @getsentry/bilby
app/models/users/ticketing.rb                                                                             @getsentry/boxoffice @getsentry/popcorn @getsentry/fang @getsentry/bilby @getsentry/libretto
app/models/users/voice_support.rb                                                                         @getsentry/voice @getsentry/bilby
app/models/users/zopim_support.rb                                                                         @getsentry/space-dogs @getsentry/bilby
app/models/voice*                                                                                         @getsentry/voice
app/models/voice/                                                                                         @getsentry/voice
app/models/workspace.rb                                                                                   @getsentry/kingfisher
app/models/workspace_element.rb                                                                           @getsentry/kingfisher
app/models/zero_state_dismissal.rb                                                                        @getsentry/ponderosa
app/models/zopim/agent.rb                                                                                 @getsentry/bilby
app/models/zopim/agents/creation.rb                                                                       @getsentry/bilby
app/models/zopim/trial.rb                                                                                 @getsentry/chat-growth
app/models/zopim_integration.rb                                                                           @getsentry/teapot @getsentry/tealeaves
app/observers/account_product_state_observer.rb                                                           @getsentry/bilby
app/observers/billing_admin_event_observer.rb                                                             @getsentry/audit-log
app/observers/brand_entity_observer.rb                                                                    @getsentry/piratos
app/observers/brand_event_bus_observer.rb                                                                 @getsentry/ingest @getsentry/boxoffice @getsentry/popcorn
app/observers/brand_logo_observer.rb                                                                      @getsentry/piratos
app/observers/certificate_observer.rb                                                                     @getsentry/piratos
app/observers/custom_field_value_observer.rb                                                              @getsentry/vinyl
app/observers/dropdown_observer.rb                                                                        @getsentry/kowari @getsentry/vinyl
app/observers/group_domain_event_observer.rb                                                              @getsentry/bolt @getsentry/secdev
app/observers/group_entity_observer.rb                                                                    @getsentry/bolt @getsentry/mongooses
app/observers/permission_event_observer.rb                                                                @getsentry/audit-log
app/observers/permission_explore_entitlements_changes_observer.rb                                         @getsentry/bilby
app/observers/permission_guide_entitlements_changes_observer.rb                                           @getsentry/bilby
app/observers/permission_set_observer.rb                                                                  @getsentry/firefly
app/observers/push_notification_observer.rb                                                               @getsentry/boxoffice @getsentry/popcorn
app/observers/subscription_product_state_observer.rb                                                      @getsentry/bilby
app/observers/user_guide_entitlements_changes_observer.rb                                                 @getsentry/bilby
app/observers/user_identity_observer.rb                                                                   @getsentry/bilby
app/observers/user_name_event_observer.rb                                                                 @getsentry/audit-log
app/observers/user_observer.rb                                                                            @getsentry/bilby
app/observers/user_otp_setting_observer.rb                                                                @getsentry/secdev @getsentry/bilby
app/observers/user_seat_changes_observer.rb                                                               @getsentry/bilby
app/observers/views_observers/                                                                            @getsentry/ingest
app/presenters/api/lotus/agent_collection_presenter.rb                                                    @getsentry/harrier
app/presenters/api/lotus/answer_bot_notification_presenter.rb                                             @getsentry/orchid
app/presenters/api/lotus/assignables/                                                                     @getsentry/harrier
app/presenters/api/lotus/assignables/groups_presenter.rb                                                  @getsentry/harrier @getsentry/bolt
app/presenters/api/lotus/ccs_and_followers/                                                               @getsentry/strongbad
app/presenters/api/lotus/chat_settings_presenter.rb                                                       @getsentry/iris
app/presenters/api/lotus/collaboration_event_presenter.rb                                                 @getsentry/collaboration
app/presenters/api/lotus/conversation_collection_presenter.rb                                             @getsentry/orchid
app/presenters/api/lotus/conversation_cursor_collection_presenter.rb                                      @getsentry/squonk
app/presenters/api/lotus/conversation_item_presenter.rb                                                   @getsentry/orchid
app/presenters/api/lotus/deleted_ticket_presenter.rb                                                      @getsentry/boxoffice @getsentry/popcorn
app/presenters/api/lotus/group_collection_presenter.rb                                                    @getsentry/harrier @getsentry/bolt
app/presenters/api/lotus/group_presenter.rb                                                               @getsentry/harrier @getsentry/bolt
app/presenters/api/lotus/knowledge_event_presenter.rb                                                     @getsentry/orchid
app/presenters/api/lotus/macro_application_presenter.rb                                                   @getsentry/fang
app/presenters/api/lotus/macro_collection_presenter.rb                                                    @getsentry/fang
app/presenters/api/lotus/macro_presenter.rb                                                               @getsentry/fang
app/presenters/api/lotus/recent_ticket_presenter.rb                                                       @getsentry/orchid
app/presenters/api/lotus/simplified_email_threading/                                                      @getsentry/strongbad
app/presenters/api/lotus/time_zone_presenter.rb                                                           @getsentry/harrier
app/presenters/api/lotus/workspace_changed_presenter.rb                                                   @getsentry/kingfisher
app/presenters/api/mobile/                                                                                @getsentry/lir
app/presenters/api/mobile/account/group_presenter.rb                                                      @getsentry/lir @getsentry/bolt
app/presenters/api/mobile/users/end_user_presenter.rb                                                     @getsentry/lir @getsentry/bilby
app/presenters/api/private/mobile_sdk/                                                                    @getsentry/lir
app/presenters/api/services/salesforce/                                                                   @getsentry/platycorn
app/presenters/api/v1/stats_presenter.rb                                                                  @getsentry/foundation-analytics-stream
app/presenters/api/v2/abilities/                                                                          @getsentry/bilby @getsentry/firefly
app/presenters/api/v2/account/addons_presenter.rb                                                         @getsentry/narwhals @getsentry/otters
app/presenters/api/v2/account/boosts_presenter.rb                                                         @getsentry/narwhals @getsentry/otters
app/presenters/api/v2/account/explore_subscription_presenter.rb                                           @getsentry/kepler
app/presenters/api/v2/account/explore_subscription_pricing_presenter.rb                                   @getsentry/narwhals @getsentry/otters
app/presenters/api/v2/account/features_presenter.rb                                                       @getsentry/quoll
app/presenters/api/v2/account/guide_subscription_pricing_presenter.rb                                     @getsentry/narwhals @getsentry/otters
app/presenters/api/v2/account/hc_settings_presenter.rb                                                    @getsentry/guide-dev
app/presenters/api/v2/account/mobile_sdk_settings_presenter.rb                                            @getsentry/lir
app/presenters/api/v2/account/multiproduct_presenter.rb                                                   @getsentry/narwhals @getsentry/otters
app/presenters/api/v2/account/sandboxes_presenter.rb                                                      @getsentry/ngiyari @getsentry/pcc-operations
app/presenters/api/v2/account/settings_presenter.rb                                                       @getsentry/bolt
app/presenters/api/v2/account/subscription_presenter.rb                                                   @getsentry/narwhals @getsentry/otters
app/presenters/api/v2/account/subscription_voice_presenter.rb                                             @getsentry/voice
app/presenters/api/v2/account/tpe_subscription_pricing_presenter.rb                                       @getsentry/narwhals @getsentry/otters
app/presenters/api/v2/account/voice*                                                                      @getsentry/voice
app/presenters/api/v2/account/voice_subscription/                                                         @getsentry/voice
app/presenters/api/v2/account/zendesk_subscription_pricing_presenter.rb                                   @getsentry/narwhals @getsentry/otters
app/presenters/api/v2/account/zopim_agent_presenter.rb                                                    @getsentry/narwhals @getsentry/otters
app/presenters/api/v2/account/zopim_subscription_presenter.rb                                             @getsentry/narwhals @getsentry/otters
app/presenters/api/v2/account/zopim_subscription_pricing_presenter.rb                                     @getsentry/narwhals @getsentry/otters
app/presenters/api/v2/admin_brand_presenter.rb                                                            @getsentry/boxoffice @getsentry/popcorn
app/presenters/api/v2/agent_brand_presenter.rb                                                            @getsentry/boxoffice @getsentry/popcorn
app/presenters/api/v2/audit_log_presenter.rb                                                              @getsentry/audit-log
app/presenters/api/v2/automatic_answer_presenter.rb                                                       @getsentry/waratah
app/presenters/api/v2/billing/                                                                            @getsentry/narwhals @getsentry/otters
app/presenters/api/v2/brand_presenter.rb                                                                  @getsentry/boxoffice @getsentry/popcorn
app/presenters/api/v2/crm_data_presenter.rb                                                               @getsentry/platycorn
app/presenters/api/v2/custom_field_option_presenter.rb                                                    @getsentry/boxoffice @getsentry/popcorn
app/presenters/api/v2/custom_field_presenter.rb                                                           @getsentry/boxoffice @getsentry/popcorn
app/presenters/api/v2/custom_status_presenter.rb                                                          @getsentry/boxoffice @getsentry/popcorn
app/presenters/api/v2/errors_presenter.rb                                                                 @getsentry/bolt
app/presenters/api/v2/exports/cursor_support.rb                                                           @getsentry/bilby
app/presenters/api/v2/exports/incremental_ticket_presenter.rb                                             @getsentry/dugong
app/presenters/api/v2/exports/incremental_user_presenter.rb                                               @getsentry/bilby
app/presenters/api/v2/feature_usage_metrics_presenter.rb                                                  @getsentry/fang @getsentry/libretto
app/presenters/api/v2/gooddata_integration_presenter.rb                                                   @getsentry/waratah
app/presenters/api/v2/group_membership_presenter.rb                                                       @getsentry/bolt
app/presenters/api/v2/group_presenter.rb                                                                  @getsentry/bolt @getsentry/teapot @getsentry/tealeaves
app/presenters/api/v2/identity_presenter.rb                                                               @getsentry/bilby
app/presenters/api/v2/integrations/jira_presenter.rb                                                      @getsentry/pegasus
app/presenters/api/v2/internal/account_settings_presenter.rb                                              @getsentry/teapot @getsentry/tealeaves
app/presenters/api/v2/internal/account_stats_presenter.rb                                                 @getsentry/classic-core-cph
app/presenters/api/v2/internal/acme_certificate_job_status_presenter.rb                                   @getsentry/secdev
app/presenters/api/v2/internal/billing/                                                                   @getsentry/narwhals @getsentry/otters
app/presenters/api/v2/internal/certificate_ip_presenter.rb                                                @getsentry/secdev
app/presenters/api/v2/internal/compliance_moves_presenter.rb                                              @getsentry/productivity-deploy
app/presenters/api/v2/internal/data_deletion_audit_job_presenter.rb                                       @getsentry/account-data-deletion
app/presenters/api/v2/internal/data_deletion_audit_presenter.rb                                           @getsentry/account-data-deletion
app/presenters/api/v2/internal/emails_presenter.rb                                                        @getsentry/strongbad
app/presenters/api/v2/internal/entity_lookup/views_tickets_presenter.rb                                   @getsentry/ingest
app/presenters/api/v2/internal/external_email_credential_presenter.rb                                     @getsentry/strongbad
app/presenters/api/v2/internal/fraud*                                                                     @getsentry/orca
app/presenters/api/v2/internal/global_inbound_mail_rate_limit_presenter.rb                                @getsentry/strongbad
app/presenters/api/v2/internal/inbound_mail_rate_limit_audit_log_presenter.rb                             @getsentry/strongbad
app/presenters/api/v2/internal/inbound_mail_rate_limit_presenter.rb                                       @getsentry/strongbad
app/presenters/api/v2/internal/monitor/fraud*                                                             @getsentry/orca
app/presenters/api/v2/internal/monitor/mobile_sdk_app_settings_presenter.rb                               @getsentry/lir
app/presenters/api/v2/internal/monitor/mobile_sdk_blips_presenter.rb                                      @getsentry/lir
app/presenters/api/v2/internal/prediction_settings_presenter.rb                                           @getsentry/waratah
app/presenters/api/v2/internal/recipient_address_presenter.rb                                             @getsentry/strongbad
app/presenters/api/v2/internal/remote_authentications_presenter.rb                                        @getsentry/unagi
app/presenters/api/v2/internal/rule_count_presenter.rb                                                    @getsentry/fang @getsentry/libretto
app/presenters/api/v2/internal/security_settings_presenter.rb                                             @getsentry/secdev @getsentry/unagi
app/presenters/api/v2/internal/staff_presenter.rb                                                         @getsentry/bilby
app/presenters/api/v2/jetpack_task_presenter.rb                                                           @getsentry/ponderosa
app/presenters/api/v2/job_status_presenter.rb                                                             @getsentry/bolt
app/presenters/api/v2/lookup_field_options_presenter.rb                                                   @getsentry/vinyl
app/presenters/api/v2/lookup_relationships_helper.rb                                                      @getsentry/vinyl
app/presenters/api/v2/mobile_sdk_app_presenter.rb                                                         @getsentry/lir
app/presenters/api/v2/onboarding_tasks_presenter.rb                                                       @getsentry/ponderosa
app/presenters/api/v2/organization_membership_presenter.rb                                                @getsentry/kowari
app/presenters/api/v2/organization_related_presenter.rb                                                   @getsentry/kowari
app/presenters/api/v2/organization_subscription_presenter.rb                                              @getsentry/kowari
app/presenters/api/v2/organizations/                                                                      @getsentry/kowari
app/presenters/api/v2/permissions/permissions_presenter.rb                                                @getsentry/firefly
app/presenters/api/v2/product_collection_presenter.rb                                                     @getsentry/harrier
app/presenters/api/v2/recipient_address_presenter.rb                                                      @getsentry/strongbad
app/presenters/api/v2/requests/custom_status_presenter.rb                                                 @getsentry/boxoffice @getsentry/popcorn
app/presenters/api/v2/requests/group_presenter.rb                                                         @getsentry/bolt
app/presenters/api/v2/requests/organization_presenter.rb                                                  @getsentry/kowari
app/presenters/api/v2/resource_collection_presenter.rb                                                    @getsentry/dingo
app/presenters/api/v2/roles/                                                                              @getsentry/firefly
app/presenters/api/v2/routing/                                                                            @getsentry/argonauts
app/presenters/api/v2/rules/                                                                              @getsentry/fang @getsentry/libretto
app/presenters/api/v2/rules/automation_presenter.rb                                                       @getsentry/libretto
app/presenters/api/v2/rules/filtered_*.rb                                                                 @getsentry/views-core @getsentry/views-enablement
app/presenters/api/v2/rules/hydrate_ticket_presenter.rb                                                   @getsentry/views-core @getsentry/views-enablement
app/presenters/api/v2/rules/macro_*.rb                                                                    @getsentry/fang
app/presenters/api/v2/rules/relationship_definitions_presenter.rb                                         @getsentry/vinyl
app/presenters/api/v2/rules/rule_category*.rb                                                             @getsentry/libretto
app/presenters/api/v2/rules/rule_diff_presenter.rb                                                        @getsentry/libretto
app/presenters/api/v2/rules/trigger_*.rb                                                                  @getsentry/libretto
app/presenters/api/v2/rules/user_view*.rb                                                                 @getsentry/penguin
app/presenters/api/v2/rules/view_*.rb                                                                     @getsentry/views-core @getsentry/views-enablement
app/presenters/api/v2/salesforce_presenter.rb                                                             @getsentry/platycorn
app/presenters/api/v2/satisfaction_rating_presenter.rb                                                    @getsentry/fang
app/presenters/api/v2/satisfaction_rating_statistics_presenter.rb                                         @getsentry/fang
app/presenters/api/v2/satisfaction_reason_presenter.rb                                                    @getsentry/fang
app/presenters/api/v2/schedule_presenter.rb                                                               @getsentry/fang
app/presenters/api/v2/search/                                                                             @getsentry/search
app/presenters/api/v2/search/lotus_user_presenter.rb                                                      @getsentry/search @getsentry/bilby
app/presenters/api/v2/sharing_agreement_presenter.rb                                                      @getsentry/boxoffice @getsentry/popcorn
app/presenters/api/v2/skip_presenter.rb                                                                   @getsentry/argonauts
app/presenters/api/v2/slas/                                                                               @getsentry/fang
app/presenters/api/v2/suspended_ticket_presenter.rb                                                       @getsentry/strongbad
app/presenters/api/v2/tags_presenter.rb                                                                   @getsentry/boxoffice @getsentry/popcorn
app/presenters/api/v2/target_failure_presenter.rb                                                         @getsentry/vegemite
app/presenters/api/v2/target_presenter.rb                                                                 @getsentry/vegemite
app/presenters/api/v2/ticket_field_condition_presenter.rb                                                 @getsentry/boxoffice @getsentry/popcorn
app/presenters/api/v2/ticket_field_presenter.rb                                                           @getsentry/boxoffice @getsentry/popcorn @getsentry/vinyl
app/presenters/api/v2/ticket_form_presenter.rb                                                            @getsentry/boxoffice @getsentry/popcorn
app/presenters/api/v2/tickets/attribute_mappings.rb                                                       @getsentry/boxoffice @getsentry/popcorn
app/presenters/api/v2/tickets/audit_custom_status_presenter.rb                                            @getsentry/boxoffice @getsentry/popcorn
app/presenters/api/v2/tickets/audit_event_collection_presenter.rb                                         @getsentry/boxoffice @getsentry/popcorn
app/presenters/api/v2/tickets/audit_event_presenter.rb                                                    @getsentry/boxoffice @getsentry/popcorn
app/presenters/api/v2/tickets/audit_presenter.rb                                                          @getsentry/boxoffice @getsentry/popcorn
app/presenters/api/v2/tickets/audit_sideloader.rb                                                         @getsentry/boxoffice @getsentry/popcorn
app/presenters/api/v2/tickets/cc_presenter.rb                                                             @getsentry/boxoffice @getsentry/popcorn
app/presenters/api/v2/tickets/ccs_and_followers_helper.rb                                                 @getsentry/strongbad
app/presenters/api/v2/tickets/change_presenter.rb                                                         @getsentry/boxoffice @getsentry/popcorn
app/presenters/api/v2/tickets/chat_event_presenter.rb                                                     @getsentry/teapot @getsentry/tealeaves
app/presenters/api/v2/tickets/comment_collection_presenter.rb                                             @getsentry/boxoffice @getsentry/popcorn
app/presenters/api/v2/tickets/comment_presenter.rb                                                        @getsentry/boxoffice @getsentry/popcorn
app/presenters/api/v2/tickets/comment_privacy_change_presenter.rb                                         @getsentry/orchid
app/presenters/api/v2/tickets/create_presenter.rb                                                         @getsentry/boxoffice @getsentry/popcorn
app/presenters/api/v2/tickets/email_cc_change_presenter.rb                                                @getsentry/strongbad
app/presenters/api/v2/tickets/email_comment_issue_presenter.rb                                            @getsentry/strongbad
app/presenters/api/v2/tickets/email_comment_presenter.rb                                                  @getsentry/strongbad
app/presenters/api/v2/tickets/error_presenter.rb                                                          @getsentry/boxoffice @getsentry/popcorn
app/presenters/api/v2/tickets/errors_presenter.rb                                                         @getsentry/boxoffice @getsentry/popcorn
app/presenters/api/v2/tickets/event_via_presenter.rb                                                      @getsentry/fang @getsentry/libretto
app/presenters/api/v2/tickets/external_presenter.rb                                                       @getsentry/boxoffice @getsentry/popcorn
app/presenters/api/v2/tickets/facebook_comment_presenter.rb                                               @getsentry/ocean
app/presenters/api/v2/tickets/facebook_event_presenter.rb                                                 @getsentry/ocean
app/presenters/api/v2/tickets/follower_change_presenter.rb                                                @getsentry/strongbad
app/presenters/api/v2/tickets/follower_notification_presenter.rb                                          @getsentry/strongbad
app/presenters/api/v2/tickets/generic_comment_presenter.rb                                                @getsentry/orchid
app/presenters/api/v2/tickets/log_me_in_transcript_presenter.rb                                           @getsentry/boxoffice @getsentry/popcorn
app/presenters/api/v2/tickets/macro_reference_presenter.rb                                                @getsentry/fang
app/presenters/api/v2/tickets/messaging_csat_event_presenter.rb                                           @getsentry/teapot @getsentry/tealeaves
app/presenters/api/v2/tickets/messaging_event_presenter.rb                                                @getsentry/snoop
app/presenters/api/v2/tickets/mobile_ticket_presenter.rb                                                  @getsentry/lir
app/presenters/api/v2/tickets/notification_presenter.rb                                                   @getsentry/boxoffice @getsentry/popcorn
app/presenters/api/v2/tickets/organization_activity_presenter.rb                                          @getsentry/kowari
app/presenters/api/v2/tickets/prediction_presenter.rb                                                     @getsentry/bunyip
app/presenters/api/v2/tickets/push_presenter.rb                                                           @getsentry/boxoffice @getsentry/popcorn
app/presenters/api/v2/tickets/re_engagement_sent_presenter.rb                                             @getsentry/woodstock
app/presenters/api/v2/tickets/related_presenter.rb                                                        @getsentry/boxoffice @getsentry/popcorn
app/presenters/api/v2/tickets/reply_options_presenter.rb                                                  @getsentry/ocean
app/presenters/api/v2/tickets/rule_revision_via_presenter.rb                                              @getsentry/libretto
app/presenters/api/v2/tickets/rule_via_presenter.rb                                                       @getsentry/fang @getsentry/libretto
app/presenters/api/v2/tickets/satisfaction_rating_event_presenter.rb                                      @getsentry/fang
app/presenters/api/v2/tickets/sla_target_change_presenter.rb                                              @getsentry/fang
app/presenters/api/v2/tickets/sms_notification_presenter.rb                                               @getsentry/voice
app/presenters/api/v2/tickets/ticket_field_helper.rb                                                      @getsentry/boxoffice @getsentry/popcorn
app/presenters/api/v2/tickets/ticket_params.rb                                                            @getsentry/boxoffice @getsentry/popcorn
app/presenters/api/v2/tickets/ticket_permissions_presenter.rb                                             @getsentry/boxoffice @getsentry/popcorn
app/presenters/api/v2/tickets/ticket_presenter.rb                                                         @getsentry/boxoffice @getsentry/popcorn
app/presenters/api/v2/tickets/ticket_sharing_event_presenter.rb                                           @getsentry/boxoffice @getsentry/popcorn
app/presenters/api/v2/tickets/translatable_error_presenter.rb                                             @getsentry/boxoffice
app/presenters/api/v2/tickets/twitter_event_presenter.rb                                                  @getsentry/ocean
app/presenters/api/v2/tickets/user_custom_field_event_presenter.rb                                        @getsentry/boxoffice @getsentry/popcorn @getsentry/bilby @getsentry/vinyl
app/presenters/api/v2/tickets/voice_comment_presenter.rb                                                  @getsentry/voice
app/presenters/api/v2/user_params.rb                                                                      @getsentry/bilby
app/presenters/api/v2/user_related_presenter.rb                                                           @getsentry/boxoffice @getsentry/popcorn @getsentry/bilby
app/presenters/api/v2/users/                                                                              @getsentry/bilby
app/presenters/api/v2/users/compliance_deletion_status_presenter.rb                                       @getsentry/bilby @getsentry/spyglass
app/presenters/api/v2/users/entitlement_presenter.rb                                                      @getsentry/bilby @getsentry/aviators
app/presenters/api/v2/users/minimal_user_presenter.rb                                                     @getsentry/boxoffice @getsentry/popcorn
app/presenters/api/v2/workspace_definitions_presenter.rb                                                  @getsentry/kingfisher
app/presenters/api/v2/workspace_presenter.rb                                                              @getsentry/kingfisher
app/presenters/cia/                                                                                       @getsentry/audit-log
app/protobuf_encoders/account_protobuf_encoder.rb                                                         @getsentry/quoll
app/protobuf_encoders/account_setting_protobuf_encoder.rb                                                 @getsentry/quoll
app/protobuf_encoders/assumption_events_protobuf_encoder.rb                                               @getsentry/secdev
app/protobuf_encoders/attachment_protobuf_encoder.rb                                                      @getsentry/squonk
app/protobuf_encoders/audit_event_protobuf_encoder.rb                                                     @getsentry/audit-log
app/protobuf_encoders/brand_events/                                                                       @getsentry/ingest @getsentry/boxoffice @getsentry/popcorn
app/protobuf_encoders/brand_events_protobuf_encoder.rb                                                    @getsentry/boxoffice @getsentry/popcorn
app/protobuf_encoders/brand_protobuf_encoder.rb                                                           @getsentry/boxoffice @getsentry/popcorn
app/protobuf_encoders/business_rule_matched_protobuf_encoder.rb                                           @getsentry/vegemite
app/protobuf_encoders/comment_protobuf_encoder.rb                                                         @getsentry/ticket-platform
app/protobuf_encoders/csat_requested_protobuf_encoder.rb                                                  @getsentry/snoop
app/protobuf_encoders/custom_field_protobuf_encoder.rb                                                    @getsentry/bilby @getsentry/vinyl
app/protobuf_encoders/custom_status_protobuf_encoder.rb                                                   @getsentry/boxoffice
app/protobuf_encoders/group_events/                                                                       @getsentry/bolt @getsentry/secdev
app/protobuf_encoders/group_events_protobuf_encoder.rb                                                    @getsentry/bolt @getsentry/secdev
app/protobuf_encoders/group_protobuf_encoder.rb                                                           @getsentry/bolt @getsentry/teapot @getsentry/tealeaves
app/protobuf_encoders/locale_protobuf_encoder.rb                                                          @getsentry/quoll
app/protobuf_encoders/organization_events/                                                                @getsentry/kowari
app/protobuf_encoders/organization_events_protobuf_encoder.rb                                             @getsentry/kowari
app/protobuf_encoders/organization_protobuf_encoder.rb                                                    @getsentry/kowari
app/protobuf_encoders/route_protobuf_encoder.rb                                                           @getsentry/boxoffice @getsentry/popcorn
app/protobuf_encoders/routing_assignment_failure_protobuf_encoder.rb                                      @getsentry/silk-road @getsentry/tea-horse
app/protobuf_encoders/routing_tasks_actor_list_encoder.rb                                                 @getsentry/silk-road @getsentry/tea-horse
app/protobuf_encoders/routing_tasks_data_encoder.rb                                                       @getsentry/silk-road @getsentry/tea-horse
app/protobuf_encoders/routing_tasks_group_data_encoder.rb                                                 @getsentry/silk-road @getsentry/tea-horse
app/protobuf_encoders/satisfaction_score_protobuf_encoder.rb                                              @getsentry/fang
app/protobuf_encoders/status_category_protobuf_encoder.rb                                                 @getsentry/boxoffice
app/protobuf_encoders/ticket_events/                                                                      @getsentry/ticket-platform
app/protobuf_encoders/ticket_events/custom_status_changed_protobuf_encoder.rb                             @getsentry/boxoffice
app/protobuf_encoders/ticket_events/schedule_changed_protobuf_encoder.rb                                  @getsentry/fang
app/protobuf_encoders/ticket_events/sla_policy_changed_protobuf_encoder.rb                                @getsentry/fang
app/protobuf_encoders/ticket_events_protobuf_encoder.rb                                                   @getsentry/ticket-platform
app/protobuf_encoders/ticket_field_entry_value_protobuf_encoder.rb                                        @getsentry/ingest @getsentry/vinyl
app/protobuf_encoders/ticket_field_protobuf_encoder.rb                                                    @getsentry/boxoffice @getsentry/popcorn @getsentry/vinyl
app/protobuf_encoders/ticket_form_protobuf_encoder.rb                                                     @getsentry/boxoffice @getsentry/popcorn
app/protobuf_encoders/ticket_priority_protobuf_encoder.rb                                                 @getsentry/boxoffice @getsentry/popcorn
app/protobuf_encoders/ticket_protobuf_encoder.rb                                                          @getsentry/boxoffice @getsentry/popcorn
app/protobuf_encoders/ticket_status_protobuf_encoder.rb                                                   @getsentry/boxoffice @getsentry/popcorn
app/protobuf_encoders/ticket_type_protobuf_encoder.rb                                                     @getsentry/boxoffice @getsentry/popcorn
app/protobuf_encoders/timestamps_protobuf_encoder.rb                                                      @getsentry/ticket-platform
app/protobuf_encoders/user_authentication_event_protobuf_encoder.rb                                       @getsentry/argonauts @getsentry/bilby
app/protobuf_encoders/user_events/                                                                        @getsentry/bilby
app/protobuf_encoders/user_events_protobuf_encoder.rb                                                     @getsentry/bilby
app/protobuf_encoders/user_logged_in_event_protobuf_encoder.rb                                            @getsentry/argonauts @getsentry/bilby
app/protobuf_encoders/user_logged_out_event_protobuf_encoder.rb                                           @getsentry/argonauts @getsentry/bilby
app/protobuf_encoders/user_protobuf_encoder.rb                                                            @getsentry/piratos @getsentry/bilby
app/protobuf_encoders/user_role_protobuf_encoder.rb                                                       @getsentry/bilby
app/protobuf_encoders/user_role_v2_protobuf_encoder.rb                                                    @getsentry/bilby
app/protobuf_encoders/user_v2_protobuf_encoder.rb                                                         @getsentry/bilby
app/protobuf_encoders/via_type_protobuf_encoder.rb                                                        @getsentry/ticket-platform
app/protobuf_encoders/views_encoders/                                                                     @getsentry/ingest
app/protobuf_encoders/zendesk_protobuf_encoder.rb                                                         @getsentry/bolt
app/services/account_name_propagator.rb                                                                   @getsentry/quoll
app/services/account_subdomain_propagator.rb                                                              @getsentry/quoll
app/services/account_synchronizer.rb                                                                      @getsentry/narwhals @getsentry/otters
app/services/base.rb                                                                                      @getsentry/narwhals @getsentry/otters
app/services/billing/                                                                                     @getsentry/narwhals @getsentry/otters
app/services/brand_publisher.rb                                                                           @getsentry/piratos
app/services/csat_requested_publisher.rb                                                                  @getsentry/snoop
app/services/custom_field/relationship_field_index_synchronizer.rb                                        @getsentry/vinyl
app/services/custom_field/sources_retriever.rb                                                            @getsentry/vinyl
app/services/group_publisher.rb                                                                           @getsentry/bolt @getsentry/mongooses
app/services/provisioning.rb                                                                              @getsentry/narwhals @getsentry/otters
app/services/provisioning/                                                                                @getsentry/narwhals @getsentry/otters
app/services/resend_account_owner_welcome_email.rb                                                        @getsentry/secdev
app/services/ticket_deflector.rb                                                                          @getsentry/waratah
app/services/user_entity_publisher.rb                                                                     @getsentry/piratos @getsentry/bilby
app/views/access/                                                                                         @getsentry/secdev @getsentry/unagi
app/views/access/*mobile*                                                                                 @getsentry/secdev @getsentry/lir
app/views/account/certificates/index.html.erb                                                             @getsentry/secdev @getsentry/unagi
app/views/account_setup/*                                                                                 @getsentry/quoll
app/views/account_setup/_connect_brand.html.erb                                                           @getsentry/bolt
app/views/accounts/*                                                                                      @getsentry/quoll
app/views/activate_trial/                                                                                 @getsentry/ponderosa
app/views/admin/*                                                                                         @getsentry/fang @getsentry/libretto
app/views/admin/rule.html.erb                                                                             @getsentry/fang @getsentry/libretto
app/views/agreement_mailer/                                                                               @getsentry/boxoffice @getsentry/popcorn
app/views/attachments/*                                                                                   @getsentry/squonk
app/views/audit_emails/                                                                                   @getsentry/strongbad
app/views/brands/                                                                                         @getsentry/boxoffice @getsentry/popcorn
app/views/brands/*                                                                                        @getsentry/boxoffice @getsentry/popcorn
app/views/cms/search/_result.html.erb                                                                     @getsentry/athene
app/views/cms/search/index.html.erb                                                                       @getsentry/athene
app/views/cms/texts/_form.html.erb                                                                        @getsentry/athene
app/views/cms/texts/_references.html.erb                                                                  @getsentry/athene
app/views/cms/texts/edit.html.erb                                                                         @getsentry/athene
app/views/cms/texts/export.html.erb                                                                       @getsentry/athene
app/views/cms/texts/import.html.erb                                                                       @getsentry/athene
app/views/cms/texts/index.html.erb                                                                        @getsentry/athene
app/views/cms/texts/new.html.erb                                                                          @getsentry/athene
app/views/cms/texts/show.html.erb                                                                         @getsentry/athene
app/views/cms/variants/_form.html.erb                                                                     @getsentry/athene
app/views/cms/variants/edit.html.erb                                                                      @getsentry/athene
app/views/cms/variants/new.html.erb                                                                       @getsentry/athene
app/views/crm/*                                                                                           @getsentry/platycorn
app/views/events/_follower_notification.html.erb                                                          @getsentry/strongbad
app/views/events/_voice*                                                                                  @getsentry/voice
app/views/events/inline/                                                                                  @getsentry/boxoffice @getsentry/popcorn
app/views/generated/javascripts/_user.erb                                                                 @getsentry/bolt
app/views/import/                                                                                         @getsentry/bilby
app/views/layouts/help_center.html.erb                                                                    @getsentry/secdev @getsentry/unagi
app/views/layouts/lotus_bootstrap.html.erb                                                                @getsentry/harrier
app/views/layouts/mobile_sdk.html.erb                                                                     @getsentry/lir
app/views/layouts/workspaces.html.erb                                                                     @getsentry/kingfisher
app/views/lotus_bootstrap/                                                                                @getsentry/harrier
app/views/macros/index.xml.builder                                                                        @getsentry/fang
app/views/mobile/                                                                                         @getsentry/lir
app/views/password_reset_requests/*                                                                       @getsentry/secdev @getsentry/unagi
app/views/people/                                                                                         @getsentry/bilby
app/views/people/groups/_header.html.erb                                                                  @getsentry/firefly
app/views/people/groups/edit.html.erb                                                                     @getsentry/firefly
app/views/reports/*                                                                                       @getsentry/foundation-analytics-stream
app/views/reports/tabs/exports/_voyager.html.erb                                                          @getsentry/views-enablement
app/views/requests/embedded/*                                                                             @getsentry/bolt
app/views/requests/organization/*                                                                         @getsentry/kowari
app/views/robots/                                                                                         @getsentry/enigma
app/views/rules/                                                                                          @getsentry/fang @getsentry/libretto
app/views/rules/apply_macro.html.erb                                                                      @getsentry/fang
app/views/satisfaction_ratings/_current_satisfaction.html.mustache.erb                                    @getsentry/fang
app/views/satisfaction_ratings/_rating_box.html.erb                                                       @getsentry/fang
app/views/satisfaction_ratings/bad_this_week.html.erb                                                     @getsentry/fang
app/views/satisfaction_ratings/good_this_week.html.erb                                                    @getsentry/fang
app/views/satisfaction_ratings/latest.js.erb                                                              @getsentry/fang
app/views/satisfaction_ratings/new_rating.html.erb                                                        @getsentry/fang
app/views/satisfaction_ratings/no_such_token.html.erb                                                     @getsentry/fang
app/views/satisfaction_ratings/thank_you.html.erb                                                         @getsentry/fang
app/views/settings/account/_owner_multiproduct.html.erb                                                   @getsentry/secdev
app/views/settings/agents/*                                                                               @getsentry/firefly
app/views/settings/agents/_settings.html.erb                                                              @getsentry/iris
app/views/settings/channels/*                                                                             @getsentry/ocean
app/views/settings/chat/                                                                                  @getsentry/chat-growth
app/views/settings/customers/*                                                                            @getsentry/bilby
app/views/settings/customers/_satisfaction.html.erb                                                       @getsentry/fang
app/views/settings/customers/_satisfaction_prediction_settings.html.erb                                   @getsentry/fang
app/views/settings/customers/_satisfaction_reasons.html.erb                                               @getsentry/fang
app/views/settings/customers/_satisfaction_reasons_list.html.erb                                          @getsentry/fang
app/views/settings/email/                                                                                 @getsentry/strongbad
app/views/settings/extensions/_target.html.erb                                                            @getsentry/vegemite
app/views/settings/extensions/_targets.html.erb                                                           @getsentry/vegemite
app/views/settings/extensions/show.html.erb                                                               @getsentry/platycorn
app/views/settings/recipient_addresses/                                                                   @getsentry/strongbad
app/views/settings/security/                                                                              @getsentry/secdev @getsentry/unagi
app/views/settings/slas/show.html.erb                                                                     @getsentry/fang
app/views/settings/tickets/                                                                               @getsentry/boxoffice @getsentry/popcorn @getsentry/strongbad
app/views/shared/_jira_sharing_options.html.erb                                                           @getsentry/boxoffice @getsentry/popcorn
app/views/shared/_macro_list.html.erb                                                                     @getsentry/fang
app/views/shared/_macro_list.mobile_v2.erb                                                                @getsentry/fang
app/views/shared/_safe_rules_search.html.erb                                                              @getsentry/fang @getsentry/libretto
app/views/shared/_support_activate_failure.html.erb                                                       @getsentry/ponderosa
app/views/shared/_ticket_custom_fields.html.erb                                                           @getsentry/boxoffice @getsentry/popcorn
app/views/shared/_tickets_table.html.erb                                                                  @getsentry/boxoffice @getsentry/popcorn
app/views/shared/help/                                                                                    @getsentry/fang @getsentry/libretto
app/views/shared/help/_automations.erb                                                                    @getsentry/libretto
app/views/shared/help/_macros.erb                                                                         @getsentry/fang
app/views/shared/help/_triggers.erb                                                                       @getsentry/libretto
app/views/shared/help/_views.erb                                                                          @getsentry/fang
app/views/sharing_agreements/                                                                             @getsentry/boxoffice @getsentry/popcorn
app/views/survey/support_churn.html.erb                                                                   @getsentry/ponderosa
app/views/suspended_tickets/                                                                              @getsentry/strongbad
app/views/tags                                                                                            @getsentry/boxoffice @getsentry/popcorn
app/views/tags/*                                                                                          @getsentry/boxoffice @getsentry/popcorn
app/views/targets/                                                                                        @getsentry/vegemite
app/views/targets/*                                                                                       @getsentry/vegemite
app/views/targets/authorize/auth_salesforce_target.html.erb                                               @getsentry/platycorn
app/views/targets/edit/_email_target.html.erb                                                             @getsentry/strongbad
app/views/targets/edit/_salesforce_target.html.erb                                                        @getsentry/platycorn
app/views/targets/select_target_to_add.html.erb                                                           @getsentry/vegemite
app/views/ticket_fields/                                                                                  @getsentry/boxoffice @getsentry/popcorn
app/views/ticket_fields/*                                                                                 @getsentry/boxoffice @getsentry/popcorn @getsentry/vinyl
app/views/tickets/                                                                                        @getsentry/boxoffice @getsentry/popcorn
app/views/user_identities/*                                                                               @getsentry/bilby
app/views/verification/*                                                                                  @getsentry/secdev @getsentry/unagi
benchmarks/                                                                                               @getsentry/squonk
bin/                                                                                                      @getsentry/squonk
config/.env.*                                                                                             @getsentry/squonk
config/.env.billing.*                                                                                     @getsentry/narwhals @getsentry/otters
config/api_routes.rb                                                                                      @getsentry/squonk @getsentry/bolt
config/application.rb                                                                                     @getsentry/squonk
config/boot.rb                                                                                            @getsentry/squonk
config/brakeman.*                                                                                         @getsentry/rails-upgrade
config/delivery_boy.yml                                                                                   @getsentry/ingest
config/deploy.rb                                                                                          @getsentry/squonk
config/initializers/                                                                                      @getsentry/squonk @getsentry/bolt @getsentry/classic-core-cph
config/initializers/00_global_uid.rb                                                                      @getsentry/ruby-core
config/initializers/07_logging.rb                                                                         @getsentry/bolt
config/initializers/10_zendesk_protobuf.rb                                                                @getsentry/ticket-platform
config/initializers/11_uploader_configuration.rb                                                          @getsentry/account-data-deletion
config/initializers/12_middleware_timing.rb                                                               @getsentry/bolt
config/initializers/14_datadog_tracer.rb                                                                  @getsentry/bolt @getsentry/classic-core-cph
config/initializers/action_view_patch.rb                                                                  @getsentry/classic-core-cph
config/initializers/active_record_stats.rb                                                                @getsentry/ingest
config/initializers/ar_datadog_sql_span_tags.rb                                                           @getsentry/bolt
config/initializers/archiver.rb                                                                           @getsentry/support-ticket-archiving
config/initializers/attachment_fu.rb                                                                      @getsentry/squonk
config/initializers/billing/                                                                              @getsentry/narwhals @getsentry/otters @getsentry/squonk @getsentry/bolt
config/initializers/db_conn_ttl.rb                                                                        @getsentry/bolt
config/initializers/db_runtime_subscriber.rb                                                              @getsentry/capacity-planning @getsentry/bolt
config/initializers/gdpr.rb                                                                               @getsentry/spyglass
config/initializers/gmail_api_sending.rb                                                                  @getsentry/strongbad
config/initializers/i18n.rb                                                                               @getsentry/bolt @getsentry/i18n
config/initializers/iron_bank.rb                                                                          @getsentry/narwhals @getsentry/otters
config/initializers/johnny_five.rb                                                                        @getsentry/views-core @getsentry/views-enablement
config/initializers/load_codeowners.rb                                                                    @getsentry/classic-core-cph
config/initializers/mail.rb                                                                               @getsentry/strongbad
config/initializers/middleware.rb                                                                         @getsentry/rails-upgrade @getsentry/classic-core-cph @getsentry/bolt
config/initializers/oauth2.rb                                                                             @getsentry/secdev @getsentry/unagi
config/initializers/patch_rails52_into_51_cves.rb                                                         @getsentry/rails-upgrade @getsentry/bolt
config/initializers/rails5_query_or.rb                                                                    @getsentry/rails-upgrade
config/initializers/rails5_tokenizer.rb                                                                   @getsentry/rails-upgrade
config/initializers/remote_files.rb                                                                       @getsentry/strongbad
config/initializers/resque.rb                                                                             @getsentry/bolt
config/initializers/schmobile.rb                                                                          @getsentry/lir
config/initializers/search_client.rb                                                                      @getsentry/search
config/initializers/sli.rb                                                                                @getsentry/sre
config/initializers/stats.rb                                                                              @getsentry/foundation-analytics-stream
config/initializers/tessa.rb                                                                              @getsentry/harrier
config/initializers/ticket_sharing.rb                                                                     @getsentry/boxoffice @getsentry/popcorn
config/initializers/zendesk_mtc_mpq_migration.rb                                                          @getsentry/strongbad
config/initializers/zuora.rb                                                                              @getsentry/narwhals @getsentry/otters
config/iron_bank                                                                                          @getsentry/narwhals @getsentry/otters
config/locales/translations/admin.yml                                                                     @getsentry/localization
config/locales/translations/admin_automation.yml                                                          @getsentry/libretto
config/locales/translations/admin_macro.yml                                                               @getsentry/fang
config/locales/translations/admin_trigger.yml                                                             @getsentry/libretto
config/locales/translations/admin_view.yml                                                                @getsentry/fang
config/locales/translations/admin_voice.yml                                                               @getsentry/localization @getsentry/voice
config/locales/translations/chat.yml                                                                      @getsentry/localization @getsentry/teapot @getsentry/tealeaves
config/locales/translations/churn_survey.yml                                                              @getsentry/localization
config/locales/translations/lotus_bootstrap.yml                                                           @getsentry/harrier
config/locales/translations/rules_admin.yml                                                               @getsentry/fang @getsentry/libretto
config/locales/translations/sample_tickets.yml                                                            @getsentry/ponderosa
config/locales/translations/shared/suspended_ticket.yml                                                   @getsentry/strongbad
config/locales/translations/shared/voice_comment.yml                                                      @getsentry/voice
config/locales/translations/slas_admin.yml                                                                @getsentry/fang
config/locales/translations/zendesk_rules_organization_catalog.yml                                        @getsentry/vinyl
config/locales/translations/zendesk_rules_ticket_catalog.yml                                              @getsentry/vinyl @getsentry/views-core @getsentry/views-enablement
config/locales/translations/zendesk_rules_user_catalog.yml                                                @getsentry/vinyl
config/mail.yml                                                                                           @getsentry/strongbad
config/onboarding/                                                                                        @getsentry/ponderosa
config/resque-schedule.yml                                                                                @getsentry/squonk
config/routes.rb                                                                                          @getsentry/bolt
config/sender_authentication/                                                                             @getsentry/strongbad
config/stats.yml                                                                                          @getsentry/foundation-analytics-stream
config/symlink.bash                                                                                       @getsentry/squonk
config/unicorn.rb                                                                                         @getsentry/squonk @getsentry/bolt
config/zuora.yml.example                                                                                  @getsentry/narwhals @getsentry/otters
config/zuora/                                                                                             @getsentry/narwhals @getsentry/otters
db/defaults/ccs_followers_rules.yml                                                                       @getsentry/strongbad
db/defaults/rule_categories.yml                                                                           @getsentry/libretto
db/defaults/rules.yml                                                                                     @getsentry/fang @getsentry/libretto
db/fixtures/050_groups.rb                                                                                 @getsentry/bolt @getsentry/teapot @getsentry/tealeaves
db/fixtures/070_users.rb                                                                                  @getsentry/bilby
db/fixtures/075_voice_groups.rb                                                                           @getsentry/voice
db/fixtures/080_memberships.rb                                                                            @getsentry/bolt @getsentry/bilby
db/fixtures/120_tickets.rb                                                                                @getsentry/boxoffice @getsentry/popcorn
db/fixtures/150_custom_fields.rb                                                                          @getsentry/boxoffice @getsentry/popcorn @getsentry/vinyl
db/fixtures/200_certificates.rb                                                                           @getsentry/secdev
db/fixtures/custom/ticket_sharing.rb.example                                                              @getsentry/boxoffice @getsentry/popcorn
db/fixtures/mondocam/shard/custom_field_options.csv                                                       @getsentry/boxoffice @getsentry/popcorn
devspace.yaml                                                                                             @getsentry/productivity-develop
dhall-config/                                                                                             @getsentry/squonk @getsentry/bolt @getsentry/classic-core-cph
dhall-config/env-vars/teams/bolt.dhall                                                                    @getsentry/bolt
dhall-config/env-vars/teams/classic-core.dhall                                                            @getsentry/classic-core-cph
dhall-config/env-vars/teams/squonk.dhall                                                                  @getsentry/squonk @getsentry/bolt
dhall-config/generated/env-vars.csv                                                                       @getsentry/squonk @getsentry/bolt @getsentry/classic-core-cph
dhall-config/generated/role-scaling.csv                                                                   @getsentry/squonk @getsentry/bolt
docker/supervisord/*                                                                                      @getsentry/productivity-develop
docs/adrs/0002-salesforce-for-zendesk-app-new-private-endpoints-in-classic.md                             @getsentry/platycorn
docs/adrs/0003-security-settings.md                                                                       @getsentry/secdev
docs/adrs/0004-owner-verification-email-request.md                                                        @getsentry/secdev
docs/adrs/0005-idempotent-support.md                                                                      @getsentry/teapot @getsentry/tealeaves
docs/adrs/0006-unified-configuration-for-support.md                                                       @getsentry/squonk
docs/adrs/0007-kafka-consumers-in-classic.md                                                              @getsentry/piratos
docs/adrs/0009-skills-based-routing-in-views.md                                                           @getsentry/argonauts
docs/adrs/0010-copying-zendesk-auth-gem-to-classic.md                                                     @getsentry/secdev @getsentry/unagi
kubernetes/                                                                                               @getsentry/squonk @getsentry/bolt
kubernetes/dhall/manifests/mail-ticket-creator.dhall                                                      @getsentry/squonk @getsentry/strongbad
kubernetes/dhall/objects/containers/mail-directories-init.dhall                                           @getsentry/squonk @getsentry/strongbad
kubernetes/dhall/objects/containers/mail-ticket-creator.dhall                                             @getsentry/squonk @getsentry/strongbad
kubernetes/dhall/objects/containers/mail-uhaul.dhall                                                      @getsentry/squonk @getsentry/strongbad
kubernetes/dhall/objects/deployments/app-server.dhall                                                     @getsentry/squonk @getsentry/classic-core-cph
kubernetes/dhall/objects/services/mail-uhaul-lb.dhall                                                     @getsentry/squonk @getsentry/strongbad
kubernetes/dhall/objects/services/mail-uhaul.dhall                                                        @getsentry/squonk @getsentry/strongbad
kubernetes/dhall/objects/stateful-sets/mail-ticket-creator.dhall                                          @getsentry/squonk @getsentry/strongbad
kubernetes/dhall/roles/mail-ticket-creator.dhall                                                          @getsentry/squonk @getsentry/strongbad
kubernetes/dhall/scale/mail-ticket-creator.dhall                                                          @getsentry/squonk @getsentry/strongbad
lib/acme_reporter.rb                                                                                      @getsentry/secdev
lib/active_record_ttl_support.rb                                                                          @getsentry/bolt
lib/automatic_answers_jwt_token.rb                                                                        @getsentry/waratah
lib/billing/                                                                                              @getsentry/narwhals @getsentry/otters
lib/billing/accounts/                                                                                     @getsentry/belugas
lib/billing/cancellation_request/                                                                         @getsentry/belugas
lib/bulk_job_data.rb                                                                                      @getsentry/bolt
lib/bulk_job_data/                                                                                        @getsentry/bolt
lib/cia_controller_support.rb                                                                             @getsentry/audit-log
lib/cia_event_creator.rb                                                                                  @getsentry/audit-log
lib/classic_allowed_parameters.rb                                                                         @getsentry/rails-upgrade
lib/classic_gc_knobs.rb                                                                                   @getsentry/bolt
lib/codepath_execution.rb                                                                                 @getsentry/classic-core-cph
lib/content_url_builder.rb                                                                                @getsentry/piratos
lib/controller_metrics/constants.rb                                                                       @getsentry/bolt
lib/controller_metrics/datadog_client.rb                                                                  @getsentry/bolt
lib/controller_metrics/file_io.rb                                                                         @getsentry/bolt
lib/controller_metrics/report_generator.rb                                                                @getsentry/bolt
lib/custom_backtrace_cleaner.rb                                                                           @getsentry/bolt
lib/datadog/answer_bot.rb                                                                                 @getsentry/waratah
lib/fraud/                                                                                                @getsentry/orca
lib/hash_param.rb                                                                                         @getsentry/rails-upgrade
lib/hc_uploader_configuration.rb                                                                          @getsentry/squonk @getsentry/account-data-deletion
lib/in_flight_job_limiter.rb                                                                              @getsentry/bolt
lib/job_v3.rb                                                                                             @getsentry/bolt
lib/job_v3/                                                                                               @getsentry/bolt
lib/job_with_status_tracking.rb                                                                           @getsentry/bolt
lib/json_with_yaml_fallback_coder.rb                                                                      @getsentry/rails-upgrade
lib/kpod_arturo.rb                                                                                        @getsentry/bolt
lib/kragle_connection.rb                                                                                  @getsentry/squonk @getsentry/classic-core-cph
lib/kragle_connection/answer_bot_service.rb                                                               @getsentry/waratah @getsentry/classic-core-cph
lib/kragle_connection/app_market.rb                                                                       @getsentry/dingo @getsentry/classic-core-cph
lib/kragle_connection/billing.rb                                                                          @getsentry/belugas @getsentry/classic-core-cph
lib/kragle_connection/explore.rb                                                                          @getsentry/classic-core-cph
lib/kragle_connection/feedback_support.rb                                                                 @getsentry/strongbad @getsentry/classic-core-cph
lib/kragle_connection/hc_locales.rb                                                                       @getsentry/lir @getsentry/classic-core-cph
lib/kragle_connection/help_center.rb                                                                      @getsentry/piratos @getsentry/classic-core-cph
lib/kragle_connection/pigeon.rb                                                                           @getsentry/lir @getsentry/classic-core-cph
lib/kragle_connection/sharing_agreement.rb                                                                @getsentry/boxoffice @getsentry/popcorn @getsentry/classic-core-cph
lib/kragle_connection/side_conversations.rb                                                               @getsentry/collaboration @getsentry/classic-core-cph
lib/kragle_connection/sunshine.rb                                                                         @getsentry/echidna @getsentry/classic-core-cph
lib/kragle_connection/voice.rb                                                                            @getsentry/voice @getsentry/classic-core-cph
lib/lazy_hybrid_cookie_serializer.rb                                                                      @getsentry/bolt
lib/middleware_timing.rb                                                                                  @getsentry/bolt
lib/mobile_session_preservation.rb                                                                        @getsentry/lir
lib/page_not_found_rendering_support.rb                                                                   @getsentry/ruby-core
lib/product_limits/controllers.rb                                                                         @getsentry/boxoffice @getsentry/popcorn
lib/product_limits/scaling_strategies/                                                                    @getsentry/boxoffice @getsentry/popcorn
lib/product_limits/user_tickets_controllers.rb                                                            @getsentry/boxoffice @getsentry/popcorn
lib/protobuf/                                                                                             @getsentry/ticket-platform
lib/pry-rails/prompt.rb                                                                                   @getsentry/ticket-platform
lib/rails4_compatible_serializer.rb                                                                       @getsentry/rails-upgrade
lib/rails_5_param_hash_regression.rb                                                                      @getsentry/rails-upgrade
lib/route_helpers.rb                                                                                      @getsentry/bolt
lib/tag_management.rb                                                                                     @getsentry/boxoffice @getsentry/popcorn
lib/tasks/brakeman.rake                                                                                   @getsentry/rails-upgrade
lib/tasks/zuora.rake                                                                                      @getsentry/narwhals @getsentry/otters
lib/tessa/                                                                                                @getsentry/harrier
lib/ticket_sharing_helper_methods.rb                                                                      @getsentry/boxoffice @getsentry/popcorn
lib/web_portal_attachment_policies.rb                                                                     @getsentry/classic-core-cph
lib/zendesk/account_readiness.rb                                                                          @getsentry/quoll
lib/zendesk/account_stats.rb                                                                              @getsentry/classic-core-cph
lib/zendesk/account_stats_mysql.rb                                                                        @getsentry/classic-core-cph
lib/zendesk/account_stats_s3.rb                                                                           @getsentry/classic-core-cph
lib/zendesk/accounts/                                                                                     @getsentry/bilby
lib/zendesk/accounts/client.rb                                                                            @getsentry/rakali
lib/zendesk/accounts/creation_region.rb                                                                   @getsentry/narwhals @getsentry/otters
lib/zendesk/accounts/custom_roles_resolver.rb                                                             @getsentry/firefly
lib/zendesk/accounts/dsl/zuora_to_credit_card.rb                                                          @getsentry/narwhals @getsentry/otters
lib/zendesk/accounts/feature_boost_support.rb                                                             @getsentry/rakali
lib/zendesk/accounts/product.rb                                                                           @getsentry/rakali @getsentry/bilby
lib/zendesk/accounts/product_payload.rb                                                                   @getsentry/rakali
lib/zendesk/accounts/rate_limiting.rb                                                                     @getsentry/boxoffice @getsentry/popcorn
lib/zendesk/accounts/role_mapping_support.rb                                                              @getsentry/rakali
lib/zendesk/accounts/security/                                                                            @getsentry/secdev @getsentry/unagi
lib/zendesk/accounts/security/remote_auth_multi_update_form.rb                                            @getsentry/unagi
lib/zendesk/accounts/security/remote_authentication_error_parser.rb                                       @getsentry/unagi
lib/zendesk/accounts/security/remote_authentication_form.rb                                               @getsentry/unagi
lib/zendesk/accounts/sku.rb                                                                               @getsentry/rakali
lib/zendesk/accounts/support_product_mapper.rb                                                            @getsentry/bilby
lib/zendesk/active_record_datadog_sql_span_tags.rb                                                        @getsentry/bolt
lib/zendesk/answer_bot_service/internal_api_client.rb                                                     @getsentry/waratah
lib/zendesk/app_market_client_v2.rb                                                                       @getsentry/dingo @getsentry/classic-core-cph
lib/zendesk/archive/                                                                                      @getsentry/support-ticket-archiving
lib/zendesk/arturo_slider.rb                                                                              @getsentry/views-core @getsentry/views-enablement
lib/zendesk/ask/                                                                                          @getsentry/argonauts
lib/zendesk/attachments/stores.rb                                                                         @getsentry/squonk
lib/zendesk/audit_logs/audit_event_kafka_publisher.rb                                                     @getsentry/audit-log
lib/zendesk/audit_logs/audit_event_publisher.rb                                                           @getsentry/kowari @getsentry/audit-log
lib/zendesk/audit_logs/base_audit_event.rb                                                                @getsentry/kowari @getsentry/audit-log
lib/zendesk/audit_logs/update_audit_event.rb                                                              @getsentry/kowari @getsentry/audit-log
lib/zendesk/auth/                                                                                         @getsentry/secdev @getsentry/unagi
lib/zendesk/auth/authentication_event_publisher.rb                                                        @getsentry/argonauts
lib/zendesk/auth/warden/callbacks/ask_publish_login_event.rb                                              @getsentry/argonauts
lib/zendesk/auth/warden/callbacks/ask_publish_logout_event.rb                                             @getsentry/argonauts
lib/zendesk/auth/warden/callbacks/set_mobile_sdk_user_locale.rb                                           @getsentry/lir
lib/zendesk/authenticated_session.rb                                                                      @getsentry/secdev
lib/zendesk/auto_translation/                                                                             @getsentry/polo
lib/zendesk/billing/                                                                                      @getsentry/narwhals @getsentry/otters
lib/zendesk/brand_creator.rb                                                                              @getsentry/boxoffice @getsentry/popcorn
lib/zendesk/business_hours_support/                                                                       @getsentry/fang
lib/zendesk/ccs_and_followers/                                                                            @getsentry/strongbad
lib/zendesk/certificate/mover.rb                                                                          @getsentry/exodus @getsentry/secdev
lib/zendesk/certificate/store.rb                                                                          @getsentry/secdev
lib/zendesk/channels/                                                                                     @getsentry/ocean
lib/zendesk/chat/                                                                                         @getsentry/teapot @getsentry/tealeaves
lib/zendesk/chat_transcripts/                                                                             @getsentry/teapot @getsentry/tealeaves
lib/zendesk/classic_process_lifecycle.rb                                                                  @getsentry/bolt @getsentry/squonk
lib/zendesk/cloudflare_rate_limiting.rb                                                                   @getsentry/orca
lib/zendesk/cms/export_job.rb                                                                             @getsentry/athene
lib/zendesk/cms/exporter.rb                                                                               @getsentry/athene
lib/zendesk/cms/import_job.rb                                                                             @getsentry/athene
lib/zendesk/cms/importer.rb                                                                               @getsentry/athene
lib/zendesk/codeowners.rb                                                                                 @getsentry/classic-core-cph @getsentry/bolt
lib/zendesk/comment_on_controller_queries.rb                                                              @getsentry/classic-core-cph
lib/zendesk/comment_on_middleware_queries.rb                                                              @getsentry/classic-core-cph
lib/zendesk/comment_on_queries.rb                                                                         @getsentry/classic-core-cph
lib/zendesk/comment_publicity.rb                                                                          @getsentry/boxoffice @getsentry/popcorn
lib/zendesk/concurrency_limiter_config.rb                                                                 @getsentry/bolt
lib/zendesk/connection_recycling/                                                                         @getsentry/bolt
lib/zendesk/controller_owner_tagging.rb                                                                   @getsentry/classic-core-cph
lib/zendesk/controller_request_timeout.rb                                                                 @getsentry/classic-core-cph
lib/zendesk/core_services/error_handling.rb                                                               @getsentry/bilby
lib/zendesk/core_services/support_seat_type_support.rb                                                    @getsentry/rakali
lib/zendesk/cursor_pagination/                                                                            @getsentry/boxoffice @getsentry/popcorn @getsentry/bilby
lib/zendesk/custom_field/                                                                                 @getsentry/boxoffice @getsentry/popcorn @getsentry/vinyl
lib/zendesk/custom_statuses/                                                                              @getsentry/boxoffice @getsentry/popcorn
lib/zendesk/data_deletion.rb                                                                              @getsentry/account-data-deletion
lib/zendesk/data_deletion/                                                                                @getsentry/account-data-deletion
lib/zendesk/data_deletion/doorman_client.rb                                                               @getsentry/guide-search @getsentry/account-data-deletion
lib/zendesk/database_backoff.rb                                                                           @getsentry/gecko
lib/zendesk/datadog_tags.rb                                                                               @getsentry/bolt @getsentry/squonk
lib/zendesk/datadog_trace_helper.rb                                                                       @getsentry/boxoffice @getsentry/popcorn
lib/zendesk/db_runtime_subscriber.rb                                                                      @getsentry/capacity-planning @getsentry/bolt
lib/zendesk/deco/                                                                                         @getsentry/argonauts
lib/zendesk/doorman_client.rb                                                                             @getsentry/rakali
lib/zendesk/doorman_header_support.rb                                                                     @getsentry/secdev
lib/zendesk/elasticsearch/controller_support.rb                                                           @getsentry/search
lib/zendesk/enterprise_recaptcha.rb                                                                       @getsentry/orca
lib/zendesk/entitlement.rb                                                                                @getsentry/bilby @getsentry/rakali
lib/zendesk/entitlements_client.rb                                                                        @getsentry/rakali
lib/zendesk/entity_publication/                                                                           @getsentry/ingest
lib/zendesk/events/audit_events/array_value_truncation.rb                                                 @getsentry/strongbad
lib/zendesk/events/controller_support.rb                                                                  @getsentry/ticket-platform
lib/zendesk/explore/internal_api_client.rb                                                                @getsentry/kepler
lib/zendesk/export/archived_audit_exporter.rb                                                             @getsentry/ticket-platform
lib/zendesk/export/archiver_v2_support.rb                                                                 @getsentry/support-ticket-archiving
lib/zendesk/export/audit_pager.rb                                                                         @getsentry/ticket-platform
lib/zendesk/export/incremental_export.rb                                                                  @getsentry/dugong
lib/zendesk/export/incremental_export_archive_finder.rb                                                   @getsentry/dugong
lib/zendesk/export/incremental_export_finder.rb                                                           @getsentry/dugong
lib/zendesk/export/incremental_export_user_finder.rb                                                      @getsentry/bilby
lib/zendesk/export/incremental_ticket_events_finder.rb                                                    @getsentry/dugong
lib/zendesk/export/incremental_ticket_export.rb                                                           @getsentry/dugong
lib/zendesk/export/incremental_ticket_metric_events_cbp_finder.rb                                         @getsentry/fang
lib/zendesk/export/incremental_ticket_metric_events_finder.rb                                             @getsentry/fang
lib/zendesk/export/raw_database_export_interface.rb                                                       @getsentry/dugong
lib/zendesk/extensions/action_controller_instrumentation.rb                                               @getsentry/squonk
lib/zendesk/extensions/ar_handle_assign_nil_attributes.rb                                                 @getsentry/rails-upgrade
lib/zendesk/extensions/ar_inherit_account_id.rb                                                           @getsentry/squonk
lib/zendesk/extensions/ar_sabotage_count.rb                                                               @getsentry/bolt @getsentry/rails-upgrade
lib/zendesk/extensions/ar_skipped_callback_metrics/                                                       @getsentry/ingest
lib/zendesk/extensions/ar_update_attribute.rb                                                             @getsentry/rails-upgrade
lib/zendesk/extensions/cia.rb                                                                             @getsentry/audit-log
lib/zendesk/extensions/mail.rb                                                                            @getsentry/strongbad
lib/zendesk/extensions/mysql2_spanid_injection.rb                                                         @getsentry/performance-wizards
lib/zendesk/extensions/rack_trusted_proxy.rb                                                              @getsentry/bolt
lib/zendesk/extensions/resque/graceful_shutdown.rb                                                        @getsentry/bolt
lib/zendesk/extensions/resque/retry_key_with_queue.rb                                                     @getsentry/bolt
lib/zendesk/extensions/resque/worker.rb                                                                   @getsentry/gecko
lib/zendesk/extensions/ticket_sharing.rb                                                                  @getsentry/boxoffice @getsentry/popcorn
lib/zendesk/extensions/zd_cross_origin_allow_locked.rb                                                    @getsentry/rails-upgrade
lib/zendesk/extensions/zendesk_auth_key_length.rb                                                         @getsentry/squonk
lib/zendesk/external_permissions/                                                                         @getsentry/space-dogs @getsentry/firefly
lib/zendesk/features/catalogs/                                                                            @getsentry/narwhals @getsentry/otters
lib/zendesk/features/change/custom_security_policy_change.rb                                              @getsentry/secdev
lib/zendesk/features/change/custom_session_timeout_change.rb                                              @getsentry/secdev
lib/zendesk/features/change/customer_satisfaction_change.rb                                               @getsentry/fang
lib/zendesk/features/change/group_rules_change.rb                                                         @getsentry/bolt @getsentry/bilby @getsentry/fang @getsentry/libretto
lib/zendesk/features/change/groups_change.rb                                                              @getsentry/bolt
lib/zendesk/features/change/multiple_organizations_change.rb                                              @getsentry/bilby @getsentry/kowari
lib/zendesk/features/change/organizations_change.rb                                                       @getsentry/bilby @getsentry/kowari
lib/zendesk/features/change/permission_sets_change.rb                                                     @getsentry/space-dogs
lib/zendesk/features/change/play_tickets_advanced_change.rb                                               @getsentry/argonauts
lib/zendesk/features/change/sandbox_change.rb                                                             @getsentry/ngiyari @getsentry/pcc-operations
lib/zendesk/features/change/talk_cti_partner_change.rb                                                    @getsentry/zenguins
lib/zendesk/features/change/ticket_threads_change.rb                                                      @getsentry/collaboration
lib/zendesk/features/change/unlimited_automations_change.rb                                               @getsentry/libretto
lib/zendesk/features/change/unlimited_rules_change.rb                                                     @getsentry/fang @getsentry/libretto
lib/zendesk/features/change/unlimited_triggers_change.rb                                                  @getsentry/libretto
lib/zendesk/features/change/unlimited_views_change.rb                                                     @getsentry/fang
lib/zendesk/features/overrides/simple_price_packaging.rb                                                  @getsentry/rakali
lib/zendesk/features/subscription_feature_service.rb                                                      @getsentry/rakali
lib/zendesk/gdpr/configuration.rb                                                                         @getsentry/spyglass
lib/zendesk/gooddata/                                                                                     @getsentry/waratah
lib/zendesk/group_memberships/finder.rb                                                                   @getsentry/bolt @getsentry/bilby
lib/zendesk/help_center/internal_api_client.rb                                                            @getsentry/piratos
lib/zendesk/i18n/backend/fast_marshal.rb                                                                  @getsentry/squonk @getsentry/i18n
lib/zendesk/i18n/fallbacks.rb                                                                             @getsentry/bolt @getsentry/i18n
lib/zendesk/i18n/language_settlement.rb                                                                   @getsentry/lir
lib/zendesk/i18n/translation_files.rb                                                                     @getsentry/bolt @getsentry/i18n
lib/zendesk/idempotency.rb                                                                                @getsentry/teapot @getsentry/tealeaves
lib/zendesk/idempotency/                                                                                  @getsentry/teapot @getsentry/tealeaves
lib/zendesk/import_export/job_enqueue.rb                                                                  @getsentry/bolt
lib/zendesk/inbound_mail.rb                                                                               @getsentry/strongbad
lib/zendesk/inbound_mail/                                                                                 @getsentry/strongbad
lib/zendesk/inbound_mail/processors/allowlist_blocklist_processor.rb                                      @getsentry/orca
lib/zendesk/inbound_mail/processors/atsd_processor.rb                                                     @getsentry/strongbad @getsentry/orca
lib/zendesk/inbound_mail/processors/phishing_tag_processor.rb                                             @getsentry/strongbad
lib/zendesk/inbound_mail/processors/reply_to_processor.rb                                                 @getsentry/strongbad
lib/zendesk/inbound_mail/processors/user_processor.rb                                                     @getsentry/strongbad @getsentry/bilby
lib/zendesk/incidents/finder.rb                                                                           @getsentry/boxoffice @getsentry/popcorn
lib/zendesk/limited_cache.rb                                                                              @getsentry/bolt
lib/zendesk/liquid/answer_bot/                                                                            @getsentry/answer-bot
lib/zendesk/liquid/cms_drop.rb                                                                            @getsentry/athene
lib/zendesk/liquid/comments/comment_drop.rb                                                               @getsentry/strongbad
lib/zendesk/liquid/comments/plain_comment_drop.rb                                                         @getsentry/strongbad
lib/zendesk/liquid/comments/views/comment.text.erb                                                        @getsentry/strongbad
lib/zendesk/liquid/comments/views/comment_formatted_new.html.erb                                          @getsentry/strongbad
lib/zendesk/liquid/comments/views/comment_simplified.html.erb                                             @getsentry/strongbad
lib/zendesk/liquid/comments/views/comment_v2.html.erb                                                     @getsentry/boxoffice @getsentry/popcorn @getsentry/strongbad
lib/zendesk/liquid/comments/voice_comment_body_drop.rb                                                    @getsentry/voice
lib/zendesk/liquid/footer/footer_drop.rb                                                                  @getsentry/strongbad
lib/zendesk/liquid/footer/views/footer.html.erb                                                           @getsentry/strongbad
lib/zendesk/liquid/mail_context.rb                                                                        @getsentry/strongbad
lib/zendesk/liquid/placeholder_suppression.rb                                                             @getsentry/strongbad
lib/zendesk/liquid/pre_processing/footer_style_injector.rb                                                @getsentry/strongbad
lib/zendesk/liquid/satisfaction_rating_drop.rb                                                            @getsentry/fang
lib/zendesk/liquid/ticket_context.rb                                                                      @getsentry/boxoffice @getsentry/popcorn
lib/zendesk/locale_presentation.rb                                                                        @getsentry/i18n
lib/zendesk/mail_inline_images_controller_support.rb                                                      @getsentry/strongbad
lib/zendesk/mailer/                                                                                       @getsentry/strongbad
lib/zendesk/maintenance/jobs/account_pruning_job.rb                                                       @getsentry/quoll
lib/zendesk/maintenance/jobs/account_risk_assessment_job.rb                                               @getsentry/orca
lib/zendesk/maintenance/jobs/acme_certificate_renewal_job.rb                                              @getsentry/secdev
lib/zendesk/maintenance/jobs/agent_workspace_auto_activation_job.rb                                       @getsentry/iris
lib/zendesk/maintenance/jobs/agent_workspace_mark_accounts_for_auto_activation_job.rb                     @getsentry/iris
lib/zendesk/maintenance/jobs/agent_workspace_mark_accounts_for_auto_activation_job_development.csv        @getsentry/iris
lib/zendesk/maintenance/jobs/agent_workspace_mark_accounts_for_auto_activation_job_production.csv         @getsentry/iris
lib/zendesk/maintenance/jobs/agent_workspace_mark_accounts_for_auto_activation_job_staging.csv            @getsentry/iris
lib/zendesk/maintenance/jobs/agent_workspace_mark_accounts_for_auto_activation_job_test.csv               @getsentry/iris
lib/zendesk/maintenance/jobs/api_account_signup_cleanup_job.rb                                            @getsentry/rakali @getsentry/bilby
lib/zendesk/maintenance/jobs/api_activity_delete_job.rb                                                   @getsentry/bolt
lib/zendesk/maintenance/jobs/api_activity_to_database_job.rb                                              @getsentry/bolt
lib/zendesk/maintenance/jobs/ask_account_onboarding.rb                                                    @getsentry/silk-road
lib/zendesk/maintenance/jobs/ask_onboarding.rb                                                            @getsentry/silk-road
lib/zendesk/maintenance/jobs/automation_job.rb                                                            @getsentry/libretto
lib/zendesk/maintenance/jobs/backlog_job.rb                                                               @getsentry/fang
lib/zendesk/maintenance/jobs/base_cleanup_job.rb                                                          @getsentry/bolt
lib/zendesk/maintenance/jobs/base_data_delete_job.rb                                                      @getsentry/account-data-deletion
lib/zendesk/maintenance/jobs/base_data_deletion_participant_job.rb                                        @getsentry/account-data-deletion
lib/zendesk/maintenance/jobs/base_job.rb                                                                  @getsentry/bolt
lib/zendesk/maintenance/jobs/base_maintenance_job.rb                                                      @getsentry/bolt
lib/zendesk/maintenance/jobs/boost_expiry_job.rb                                                          @getsentry/billing
lib/zendesk/maintenance/jobs/bulk_job_data_cleanup_job.rb                                                 @getsentry/bolt
lib/zendesk/maintenance/jobs/certificate_maintenance_job.rb                                               @getsentry/secdev
lib/zendesk/maintenance/jobs/clear_inactive_device_tokens_job.rb                                          @getsentry/secdev
lib/zendesk/maintenance/jobs/compliance_user_deletion_feedback_job.rb                                     @getsentry/spyglass
lib/zendesk/maintenance/jobs/compliance_user_deletion_job.rb                                              @getsentry/bilby
lib/zendesk/maintenance/jobs/compliance_user_deletion_requeue_job.rb                                      @getsentry/spyglass
lib/zendesk/maintenance/jobs/conditional_rate_limits_cleanup_job.rb                                       @getsentry/bilby
lib/zendesk/maintenance/jobs/daily_maintenance_job.rb                                                     @getsentry/secdev @getsentry/billing
lib/zendesk/maintenance/jobs/daily_ticket_close_on_shard_job.rb                                           @getsentry/ticket-platform
lib/zendesk/maintenance/jobs/delete_passwords_job.rb                                                      @getsentry/secdev
lib/zendesk/maintenance/jobs/delete_redundant_changes_job.rb                                              @getsentry/boxoffice @getsentry/popcorn
lib/zendesk/maintenance/jobs/deprovision_gooddata_accounts.csv                                            @getsentry/waratah
lib/zendesk/maintenance/jobs/deprovision_gooddata_job.rb                                                  @getsentry/waratah
lib/zendesk/maintenance/jobs/high_security_policy_warning_job.rb                                          @getsentry/secdev
lib/zendesk/maintenance/jobs/hourly_maintenance_job.rb                                                    @getsentry/rakali @getsentry/bilby
lib/zendesk/maintenance/jobs/monkey_job_v3.rb                                                             @getsentry/bolt
lib/zendesk/maintenance/jobs/notification_checker_job.rb                                                  @getsentry/strongbad
lib/zendesk/maintenance/jobs/organization_membership_cleanup_job.rb                                       @getsentry/kowari
lib/zendesk/maintenance/jobs/per_account_job.rb                                                           @getsentry/bolt
lib/zendesk/maintenance/jobs/per_shard_job.rb                                                             @getsentry/bolt
lib/zendesk/maintenance/jobs/pod_maintenance_job.rb                                                       @getsentry/bolt
lib/zendesk/maintenance/jobs/process_temporary_agents_addon_job.rb                                        @getsentry/billing
lib/zendesk/maintenance/jobs/remove_actor_management_service_data_job.rb                                  @getsentry/soju
lib/zendesk/maintenance/jobs/remove_agent_state_management_service_data_job.rb                            @getsentry/kopi
lib/zendesk/maintenance/jobs/remove_answer_bot_flow_composer_data_job.rb                                  @getsentry/koalai
lib/zendesk/maintenance/jobs/remove_answer_bot_flow_director_data_job.rb                                  @getsentry/aha-pandai
lib/zendesk/maintenance/jobs/remove_attachments_from_cloud_job.rb                                         @getsentry/account-data-deletion
lib/zendesk/maintenance/jobs/remove_certificates_job.rb                                                   @getsentry/account-data-deletion
lib/zendesk/maintenance/jobs/remove_collaboration_data_job.rb                                             @getsentry/collaboration
lib/zendesk/maintenance/jobs/remove_conversational_ml_data_job.rb                                         @getsentry/ml-apac-numbats
lib/zendesk/maintenance/jobs/remove_custom_resources_job.rb                                               @getsentry/vinyl
lib/zendesk/maintenance/jobs/remove_embeddings_after_delete_job.rb                                        @getsentry/waratah
lib/zendesk/maintenance/jobs/remove_explore_data_job.rb                                                   @getsentry/kepler
lib/zendesk/maintenance/jobs/remove_export_artefacts_job.rb                                               @getsentry/account-data-deletion
lib/zendesk/maintenance/jobs/remove_flow_builder_conversational_shortcuts_data_job.rb                     @getsentry/koalai
lib/zendesk/maintenance/jobs/remove_gooddata_integration_job.rb                                           @getsentry/account-data-deletion
lib/zendesk/maintenance/jobs/remove_guide_external_content_participant_data_job.rb                        @getsentry/guide-search
lib/zendesk/maintenance/jobs/remove_hc_attachments_job.rb                                                 @getsentry/account-data-deletion
lib/zendesk/maintenance/jobs/remove_hc_entities_participant_job.rb                                        @getsentry/guide-search
lib/zendesk/maintenance/jobs/remove_legion_data_job.rb                                                    @getsentry/account-data-deletion
lib/zendesk/maintenance/jobs/remove_ml_triage_data_participant_job.rb                                     @getsentry/lynx
lib/zendesk/maintenance/jobs/remove_onboarding_experience_service_data_job.rb                             @getsentry/ponderosa
lib/zendesk/maintenance/jobs/remove_pigeon_data_job.rb                                                    @getsentry/account-data-deletion
lib/zendesk/maintenance/jobs/remove_platform_logs_data_job.rb                                             @getsentry/dugong
lib/zendesk/maintenance/jobs/remove_riak_data_job.rb                                                      @getsentry/ticket-platform
lib/zendesk/maintenance/jobs/remove_s3_inbound_email_job.rb                                               @getsentry/strongbad
lib/zendesk/maintenance/jobs/remove_sell_data_job.rb                                                      @getsentry/sell-core-services
lib/zendesk/maintenance/jobs/remove_shard_data_job.rb                                                     @getsentry/account-data-deletion
lib/zendesk/maintenance/jobs/remove_sunshine_events_profiles_job.rb                                       @getsentry/echidna
lib/zendesk/maintenance/jobs/remove_text_matching_ml_data_job.rb                                          @getsentry/ml-apac-numbats
lib/zendesk/maintenance/jobs/remove_voice_data_job.rb                                                     @getsentry/voice
lib/zendesk/maintenance/jobs/remove_voice_data_participant_job.rb                                         @getsentry/voice
lib/zendesk/maintenance/jobs/revere_synchronization_job.rb                                                @getsentry/sunburst
lib/zendesk/maintenance/jobs/revoke_external_email_credentials_job.rb                                     @getsentry/strongbad
lib/zendesk/maintenance/jobs/satisfaction_rating_intention_job.rb                                         @getsentry/fang
lib/zendesk/maintenance/jobs/scrub_ticket_requester_job.rb                                                @getsentry/argonauts
lib/zendesk/maintenance/jobs/security_policy_mailer_job.rb                                                @getsentry/secdev
lib/zendesk/maintenance/jobs/select_tickets_for_scrubbing_job.rb                                          @getsentry/ticket-platform
lib/zendesk/maintenance/jobs/sharded_subscription_job.rb                                                  @getsentry/billing
lib/zendesk/maintenance/jobs/stat_cleanup_job.rb                                                          @getsentry/foundation-analytics-stream
lib/zendesk/maintenance/jobs/support_address_status_job.rb                                                @getsentry/strongbad
lib/zendesk/maintenance/jobs/suspended_ticket_notification_job.rb                                         @getsentry/boxoffice @getsentry/popcorn
lib/zendesk/maintenance/jobs/talk_usage_monitoring_job.rb                                                 @getsentry/narwhals @getsentry/otters
lib/zendesk/maintenance/jobs/thesaurus_reset_job.rb                                                       @getsentry/boxoffice @getsentry/popcorn
lib/zendesk/maintenance/jobs/ticket_deletion_job.rb                                                       @getsentry/boxoffice @getsentry/popcorn
lib/zendesk/maintenance/jobs/trial_expiry_job.rb                                                          @getsentry/narwhals @getsentry/otters
lib/zendesk/maintenance/jobs/two_factor_job.rb                                                            @getsentry/secdev
lib/zendesk/maintenance/jobs/unsubscribe_twitter_job.rb                                                   @getsentry/ocean
lib/zendesk/maintenance/jobs/unuploaded_usage_cleanup_job.rb                                              @getsentry/narwhals @getsentry/otters
lib/zendesk/maintenance/jobs/user_contact_information_job.rb                                              @getsentry/bilby
lib/zendesk/maintenance/jobs/user_count_job.rb                                                            @getsentry/bilby
lib/zendesk/maintenance/jobs/voice_partner_edition_trial_expiry_job.rb                                    @getsentry/zenguins
lib/zendesk/maintenance/util/batch_close.rb                                                               @getsentry/ticket-platform
lib/zendesk/maintenance/util/subdomain_releaser.rb                                                        @getsentry/account-data-deletion
lib/zendesk/messaging_csat/                                                                               @getsentry/teapot @getsentry/tealeaves
lib/zendesk/method_call_instrumentation.rb                                                                @getsentry/bilby
lib/zendesk/ml_triage_client.rb                                                                           @getsentry/lynx
lib/zendesk/mobile_sdk/                                                                                   @getsentry/lir
lib/zendesk/mobile_sdk/user_initializer.rb                                                                @getsentry/lir @getsentry/bilby
lib/zendesk/model_change_instrumentation.rb                                                               @getsentry/rakali
lib/zendesk/model_limit.rb                                                                                @getsentry/bolt @getsentry/rails-upgrade
lib/zendesk/monitor/jobs/exception_tracker_heartbeat_job.rb                                               @getsentry/bolt
lib/zendesk/monitor/owner_changer.rb                                                                      @getsentry/bilby
lib/zendesk/offset_pagination_limiter.rb                                                                  @getsentry/bilby
lib/zendesk/organization/                                                                                 @getsentry/kowari
lib/zendesk/organization_memberships/                                                                     @getsentry/bilby @getsentry/kowari
lib/zendesk/organization_memberships/finder.rb                                                            @getsentry/bilby @getsentry/kowari
lib/zendesk/organization_subscriptions/                                                                   @getsentry/bilby @getsentry/kowari
lib/zendesk/organization_subscriptions/finder.rb                                                          @getsentry/bilby @getsentry/kowari
lib/zendesk/param_declarations.rb                                                                         @getsentry/rails-upgrade
lib/zendesk/param_declarations/attachment.rb                                                              @getsentry/spyglass
lib/zendesk/param_declarations/comment.rb                                                                 @getsentry/boxoffice @getsentry/popcorn
lib/zendesk/param_declarations/custom_field/field_manager.rb                                              @getsentry/boxoffice @getsentry/popcorn @getsentry/vinyl
lib/zendesk/param_declarations/external_permission.rb                                                     @getsentry/space-dogs @getsentry/firefly
lib/zendesk/param_declarations/targets_initializer.rb                                                     @getsentry/vegemite
lib/zendesk/param_declarations/ticket.rb                                                                  @getsentry/boxoffice @getsentry/popcorn @getsentry/ticket-platform
lib/zendesk/param_declarations/ticket_initializer.rb                                                      @getsentry/boxoffice @getsentry/popcorn
lib/zendesk/param_declarations/user_initializer.rb                                                        @getsentry/bilby
lib/zendesk/permissions/permission_change_custom_metrics.rb                                               @getsentry/firefly
lib/zendesk/pid_equalizer.rb                                                                              @getsentry/gecko
lib/zendesk/product_limit/                                                                                @getsentry/fang @getsentry/libretto
lib/zendesk/profile_handler.rb                                                                            @getsentry/bolt
lib/zendesk/push_notifications/gdpr/gdpr_feedback_publisher.rb                                            @getsentry/argonauts
lib/zendesk/push_notifications/gdpr/gdpr_feedback_subscriber.rb                                           @getsentry/spyglass
lib/zendesk/push_notifications/gdpr/gdpr_publisher.rb                                                     @getsentry/argonauts @getsentry/spyglass
lib/zendesk/push_notifications/gdpr/gdpr_sns_feedback_publisher.rb                                        @getsentry/argonauts
lib/zendesk/push_notifications/gdpr/gdpr_sns_publisher.rb                                                 @getsentry/argonauts @getsentry/spyglass
lib/zendesk/push_notifications/gdpr/gdpr_sns_user_deletion_publisher.rb                                   @getsentry/spyglass @getsentry/bilby
lib/zendesk/push_notifications/gdpr/gdpr_sqs_feedback_subscriber.rb                                       @getsentry/spyglass
lib/zendesk/push_notifications/gdpr/gdpr_sqs_subscriber.rb                                                @getsentry/argonauts @getsentry/spyglass
lib/zendesk/push_notifications/gdpr/gdpr_sqs_user_deletion_subscriber.rb                                  @getsentry/argonauts
lib/zendesk/push_notifications/gdpr/gdpr_subscriber.rb                                                    @getsentry/argonauts @getsentry/spyglass
lib/zendesk/push_notifications/gdpr/gdpr_user_deletion_publisher.rb                                       @getsentry/spyglass @getsentry/bilby
lib/zendesk/push_notifications/gdpr/gdpr_user_deletion_subscriber.rb                                      @getsentry/bilby
lib/zendesk/query/fields.rb                                                                               @getsentry/boxoffice @getsentry/popcorn
lib/zendesk/record_counter/archive_support.rb                                                             @getsentry/ticket-platform
lib/zendesk/record_counter/assigned_tickets.rb                                                            @getsentry/boxoffice @getsentry/popcorn
lib/zendesk/record_counter/audits.rb                                                                      @getsentry/boxoffice @getsentry/popcorn
lib/zendesk/record_counter/base.rb                                                                        @getsentry/boxoffice @getsentry/popcorn @getsentry/bilby
lib/zendesk/record_counter/brands.rb                                                                      @getsentry/boxoffice @getsentry/popcorn
lib/zendesk/record_counter/ccd_tickets.rb                                                                 @getsentry/strongbad
lib/zendesk/record_counter/collaborated_tickets.rb                                                        @getsentry/strongbad
lib/zendesk/record_counter/comments.rb                                                                    @getsentry/orchid
lib/zendesk/record_counter/deleted_tickets.rb                                                             @getsentry/boxoffice @getsentry/popcorn
lib/zendesk/record_counter/deleted_users.rb                                                               @getsentry/bilby
lib/zendesk/record_counter/followed_tickets.rb                                                            @getsentry/boxoffice @getsentry/popcorn
lib/zendesk/record_counter/group_memberships.rb                                                           @getsentry/bolt
lib/zendesk/record_counter/groups.rb                                                                      @getsentry/bolt
lib/zendesk/record_counter/identities.rb                                                                  @getsentry/bilby
lib/zendesk/record_counter/incidents.rb                                                                   @getsentry/boxoffice @getsentry/popcorn
lib/zendesk/record_counter/macro_groups.rb                                                                @getsentry/fang
lib/zendesk/record_counter/macros.rb                                                                      @getsentry/fang
lib/zendesk/record_counter/organization_fields.rb                                                         @getsentry/kowari @getsentry/vinyl
lib/zendesk/record_counter/organization_memberships.rb                                                    @getsentry/bilby @getsentry/kowari
lib/zendesk/record_counter/organization_subscriptions.rb                                                  @getsentry/bilby @getsentry/kowari
lib/zendesk/record_counter/organizations.rb                                                               @getsentry/kowari
lib/zendesk/record_counter/problems.rb                                                                    @getsentry/boxoffice @getsentry/popcorn
lib/zendesk/record_counter/requested_tickets.rb                                                           @getsentry/boxoffice @getsentry/popcorn
lib/zendesk/record_counter/requests.rb                                                                    @getsentry/boxoffice @getsentry/popcorn
lib/zendesk/record_counter/satisfaction_ratings.rb                                                        @getsentry/fang
lib/zendesk/record_counter/tag_scores.rb                                                                  @getsentry/boxoffice @getsentry/popcorn
lib/zendesk/record_counter/ticket_activities.rb                                                           @getsentry/ticket-platform
lib/zendesk/record_counter/ticket_fields.rb                                                               @getsentry/boxoffice @getsentry/popcorn
lib/zendesk/record_counter/ticket_metric_events.rb                                                        @getsentry/fang
lib/zendesk/record_counter/ticket_metric_scores.rb                                                        @getsentry/fang
lib/zendesk/record_counter/tickets.rb                                                                     @getsentry/boxoffice @getsentry/popcorn
lib/zendesk/record_counter/user_fields.rb                                                                 @getsentry/bilby @getsentry/vinyl
lib/zendesk/record_counter/users.rb                                                                       @getsentry/bilby
lib/zendesk/record_counter/users_pagination.rb                                                            @getsentry/classic-core-cph
lib/zendesk/record_counter/views.rb                                                                       @getsentry/views-core @getsentry/views-enablement
lib/zendesk/redis_client_helper.rb                                                                        @getsentry/bolt
lib/zendesk/remote_files_config/loader.rb                                                                 @getsentry/strongbad
lib/zendesk/reply_parser_instrumentation.rb                                                               @getsentry/strongbad
lib/zendesk/reports/controller_support.rb                                                                 @getsentry/foundation-analytics-stream
lib/zendesk/reports/processor.rb                                                                          @getsentry/foundation-analytics-stream
lib/zendesk/request_origin_details.rb                                                                     @getsentry/squonk
lib/zendesk/requests/finder.rb                                                                            @getsentry/boxoffice @getsentry/popcorn
lib/zendesk/resource_collection/                                                                          @getsentry/dingo
lib/zendesk/resource_collection/automation_params_sanitizer.rb                                            @getsentry/libretto
lib/zendesk/resource_collection/custom_field_params_sanitizer.rb                                          @getsentry/bilby
lib/zendesk/resource_collection/macro_params_sanitizer.rb                                                 @getsentry/fang
lib/zendesk/resource_collection/organization_field_manager.rb                                             @getsentry/kowari
lib/zendesk/resource_collection/params_sanitizer.rb                                                       @getsentry/rails-upgrade
lib/zendesk/resource_collection/rule_manager.rb                                                           @getsentry/fang @getsentry/libretto
lib/zendesk/resource_collection/target_manager.rb                                                         @getsentry/vegemite
lib/zendesk/resource_collection/target_params_sanitizer.rb                                                @getsentry/vegemite
lib/zendesk/resource_collection/ticket_field_manager.rb                                                   @getsentry/boxoffice @getsentry/popcorn
lib/zendesk/resource_collection/ticket_field_params_sanitizer.rb                                          @getsentry/boxoffice @getsentry/popcorn
lib/zendesk/resource_collection/trigger_params_sanitizer.rb                                               @getsentry/libretto
lib/zendesk/resource_collection/user_field_manager.rb                                                     @getsentry/bilby
lib/zendesk/resource_collection/view_params_sanitizer.rb                                                  @getsentry/views-core @getsentry/views-enablement
lib/zendesk/resque_exception_tracking.rb                                                                  @getsentry/bolt
lib/zendesk/resque_query_comments.rb                                                                      @getsentry/bolt
lib/zendesk/routing/                                                                                      @getsentry/argonauts
lib/zendesk/routing_validations.rb                                                                        @getsentry/boxoffice @getsentry/popcorn
lib/zendesk/rule_selection.rb                                                                             @getsentry/fang @getsentry/libretto
lib/zendesk/rule_selection/                                                                               @getsentry/fang @getsentry/libretto
lib/zendesk/rule_selection/macro_usage.rb                                                                 @getsentry/fang
lib/zendesk/rules/                                                                                        @getsentry/fang @getsentry/libretto
lib/zendesk/rules/automation*                                                                             @getsentry/libretto
lib/zendesk/rules/broken_occam_ticket_count.rb                                                            @getsentry/views-core @getsentry/views-enablement
lib/zendesk/rules/categories/                                                                             @getsentry/libretto
lib/zendesk/rules/condition.rb                                                                            @getsentry/views-core @getsentry/views-enablement
lib/zendesk/rules/context.rb                                                                              @getsentry/views-core @getsentry/views-enablement
lib/zendesk/rules/context_cache.rb                                                                        @getsentry/views-core @getsentry/views-enablement
lib/zendesk/rules/controller_support/views_rate_limiter_support.rb                                        @getsentry/views-core @getsentry/views-enablement
lib/zendesk/rules/definition_metadata.rb                                                                  @getsentry/views-core @getsentry/views-enablement
lib/zendesk/rules/definitions.rb                                                                          @getsentry/views-core @getsentry/views-enablement
lib/zendesk/rules/dehydrated_ticket.rb                                                                    @getsentry/libretto
lib/zendesk/rules/diff.rb                                                                                 @getsentry/libretto
lib/zendesk/rules/dynamic_content.rb                                                                      @getsentry/views-core @getsentry/views-enablement
lib/zendesk/rules/execution_options.rb                                                                    @getsentry/views-core @getsentry/views-enablement
lib/zendesk/rules/macro/                                                                                  @getsentry/fang
lib/zendesk/rules/macro_application.rb                                                                    @getsentry/fang
lib/zendesk/rules/match.rb                                                                                @getsentry/libretto
lib/zendesk/rules/occam_*.rb                                                                              @getsentry/views-core @getsentry/views-enablement
lib/zendesk/rules/position_update_with_categories.rb                                                      @getsentry/views-core @getsentry/libretto
lib/zendesk/rules/preview.rb                                                                              @getsentry/views-core @getsentry/views-enablement
lib/zendesk/rules/query.rb                                                                                @getsentry/views-core @getsentry/views-enablement
lib/zendesk/rules/relationship_filter.rb                                                                  @getsentry/vinyl
lib/zendesk/rules/rule_executer.rb                                                                        @getsentry/views-core @getsentry/views-enablement
lib/zendesk/rules/rule_executer/                                                                          @getsentry/views-core @getsentry/views-enablement
lib/zendesk/rules/rule_query_builder.rb                                                                   @getsentry/views-core @getsentry/views-enablement
lib/zendesk/rules/side_loadable.rb                                                                        @getsentry/fang @getsentry/libretto @getsentry/vortex
lib/zendesk/rules/trigger/                                                                                @getsentry/libretto
lib/zendesk/rules/trigger_definition.rb                                                                   @getsentry/libretto
lib/zendesk/rules/validators/                                                                             @getsentry/views-core @getsentry/views-enablement
lib/zendesk/rules/view/                                                                                   @getsentry/views-core @getsentry/views-enablement
lib/zendesk/rules/view/view_queue.rb                                                                      @getsentry/tea-horse
lib/zendesk/rules/views_rate_limiter.rb                                                                   @getsentry/views-core @getsentry/views-enablement
lib/zendesk/safe_regexp_reporting.rb                                                                      @getsentry/boxoffice @getsentry/popcorn
lib/zendesk/salesforce.rb                                                                                 @getsentry/platycorn
lib/zendesk/salesforce/                                                                                   @getsentry/platycorn
lib/zendesk/sandbox/                                                                                      @getsentry/ngiyari @getsentry/pcc-operations
lib/zendesk/satisfaction_ratings/finder.rb                                                                @getsentry/fang
lib/zendesk/satisfaction_reasons/controller_support.rb                                                    @getsentry/fang
lib/zendesk/scrub.rb                                                                                      @getsentry/boxoffice @getsentry/popcorn
lib/zendesk/search.rb                                                                                     @getsentry/search
lib/zendesk/search/                                                                                       @getsentry/search
lib/zendesk/security_policy.rb                                                                            @getsentry/secdev
lib/zendesk/security_policy/validation.rb                                                                 @getsentry/secdev
lib/zendesk/sell/internal_api_client.rb                                                                   @getsentry/sell-core-services
lib/zendesk/serialization/attachment_serialization.rb                                                     @getsentry/squonk
lib/zendesk/serialization/collaboration_serialization.rb                                                  @getsentry/strongbad
lib/zendesk/serialization/group_serialization.rb                                                          @getsentry/bolt
lib/zendesk/serialization/macro_reference_serialization.rb                                                @getsentry/fang
lib/zendesk/serialization/organization_serialization.rb                                                   @getsentry/kowari
lib/zendesk/serialization/permission_set_serialization.rb                                                 @getsentry/space-dogs @getsentry/firefly
lib/zendesk/serialization/preview_results_serialization.rb                                                @getsentry/views-core @getsentry/views-enablement
lib/zendesk/serialization/preview_tickets_serialization.rb                                                @getsentry/views-core @getsentry/views-enablement
lib/zendesk/serialization/rule_serialization.rb                                                           @getsentry/fang @getsentry/libretto
lib/zendesk/serialization/satisfaction_rating_serialization.rb                                            @getsentry/fang
lib/zendesk/serialization/search/                                                                         @getsentry/search
lib/zendesk/serialization/sms_notification_serialization.rb                                               @getsentry/voice
lib/zendesk/serialization/tag_score_serialization.rb                                                      @getsentry/views-core @getsentry/views-enablement
lib/zendesk/serialization/ticket_serialization.rb                                                         @getsentry/boxoffice @getsentry/popcorn
lib/zendesk/serialization/ticket_sharing_event_serialization.rb                                           @getsentry/boxoffice @getsentry/popcorn
lib/zendesk/serialization/user_any_channel_identity_serialization.rb                                      @getsentry/ocean @getsentry/bilby
lib/zendesk/serialization/user_email_identity_serialization.rb                                            @getsentry/bilby
lib/zendesk/serialization/user_facebook_identity_serialization.rb                                         @getsentry/bilby
lib/zendesk/serialization/user_identity_serialization.rb                                                  @getsentry/bilby
lib/zendesk/serialization/user_phone_number_identity_serialization.rb                                     @getsentry/bilby
lib/zendesk/serialization/user_serialization.rb                                                           @getsentry/bilby
lib/zendesk/serialization/user_twitter_identity_serialization.rb                                          @getsentry/bilby
lib/zendesk/serialization/view_serialization.rb                                                           @getsentry/views-core @getsentry/views-enablement
lib/zendesk/session_management.rb                                                                         @getsentry/secdev
lib/zendesk/shard_mover/                                                                                  @getsentry/account-data-deletion
lib/zendesk/side_conversations/internal_api_client.rb                                                     @getsentry/collaboration
lib/zendesk/simplified_email_threading/                                                                   @getsentry/strongbad
lib/zendesk/sla.rb                                                                                        @getsentry/fang
lib/zendesk/sla/                                                                                          @getsentry/fang
lib/zendesk/slack/render_utils.rb                                                                         @getsentry/pegasus
lib/zendesk/sli_request_tagger.rb                                                                         @getsentry/views-core @getsentry/views-enablement
lib/zendesk/sms/                                                                                          @getsentry/voice
lib/zendesk/spp_health_check.rb                                                                           @getsentry/bilby
lib/zendesk/staff_client.rb                                                                               @getsentry/bilby @getsentry/rakali
lib/zendesk/stats/active_record_stats*                                                                    @getsentry/ingest
lib/zendesk/stats/consul_to_stats_yml_adapter.rb                                                          @getsentry/foundation-analytics-stream @getsentry/squonk
lib/zendesk/stats/rollup_job.rb                                                                           @getsentry/foundation-analytics-stream
lib/zendesk/stores/                                                                                       @getsentry/squonk
lib/zendesk/stores/backfill/                                                                              @getsentry/squonk
lib/zendesk/stripped_phone_number.rb                                                                      @getsentry/kelpie
lib/zendesk/suite_trial.rb                                                                                @getsentry/rakali
lib/zendesk/sunshine/account_config_client.rb                                                             @getsentry/echidna
lib/zendesk/support_accounts/                                                                             @getsentry/bilby @getsentry/rakali
lib/zendesk/support_users.rb                                                                              @getsentry/bilby
lib/zendesk/support_users/                                                                                @getsentry/bilby @getsentry/rakali
lib/zendesk/support_users/entitlement_change_remediation.rb                                               @getsentry/rakali
lib/zendesk/support_users/entitlement_synchronizer_lock.rb                                                @getsentry/rakali
lib/zendesk/support_users/internal/role_validator.rb                                                      @getsentry/bilby @getsentry/rakali
lib/zendesk/support_users/support_entitlement_translator.rb                                               @getsentry/rakali
lib/zendesk/system_user_auth_ip_validation.rb                                                             @getsentry/secdev
lib/zendesk/targets/                                                                                      @getsentry/vegemite
lib/zendesk/ticket_activities/finder.rb                                                                   @getsentry/ticket-platform
lib/zendesk/ticket_anonymizer/                                                                            @getsentry/argonauts
lib/zendesk/ticket_anonymizer/anonymous_user.rb                                                           @getsentry/argonauts @getsentry/bilby
lib/zendesk/ticket_field_condition_conversion.rb                                                          @getsentry/boxoffice @getsentry/popcorn
lib/zendesk/ticket_fields/finder.rb                                                                       @getsentry/boxoffice @getsentry/popcorn
lib/zendesk/ticket_forms/                                                                                 @getsentry/boxoffice @getsentry/popcorn
lib/zendesk/ticket_metric.rb                                                                              @getsentry/fang
lib/zendesk/ticket_metric/                                                                                @getsentry/fang
lib/zendesk/tickets/anonymous/controller_support.rb                                                       @getsentry/boxoffice @getsentry/popcorn
lib/zendesk/tickets/anonymous/initializer.rb                                                              @getsentry/boxoffice @getsentry/popcorn
lib/zendesk/tickets/anonymous/ticket_invalid.rb                                                           @getsentry/boxoffice @getsentry/popcorn
lib/zendesk/tickets/archive_finders.rb                                                                    @getsentry/support-ticket-archiving
lib/zendesk/tickets/business_hours.rb                                                                     @getsentry/fang
lib/zendesk/tickets/channels.rb                                                                           @getsentry/ocean
lib/zendesk/tickets/client_info.rb                                                                        @getsentry/boxoffice @getsentry/popcorn
lib/zendesk/tickets/closed_updates.rb                                                                     @getsentry/teapot @getsentry/tealeaves @getsentry/ticket-platform
lib/zendesk/tickets/collaboration_support.rb                                                              @getsentry/strongbad
lib/zendesk/tickets/comment_update.rb                                                                     @getsentry/orchid
lib/zendesk/tickets/comments/                                                                             @getsentry/orchid
lib/zendesk/tickets/comments/email_comment_support.rb                                                     @getsentry/strongbad
lib/zendesk/tickets/controller_support.rb                                                                 @getsentry/boxoffice @getsentry/popcorn
lib/zendesk/tickets/facebook.rb                                                                           @getsentry/ocean
lib/zendesk/tickets/finder.rb                                                                             @getsentry/boxoffice @getsentry/popcorn
lib/zendesk/tickets/http_request_parameters.rb                                                            @getsentry/boxoffice @getsentry/popcorn
lib/zendesk/tickets/importer.rb                                                                           @getsentry/boxoffice @getsentry/popcorn
lib/zendesk/tickets/initializer.rb                                                                        @getsentry/boxoffice @getsentry/popcorn
lib/zendesk/tickets/merger.rb                                                                             @getsentry/boxoffice @getsentry/popcorn
lib/zendesk/tickets/metric_sets_pagination.rb                                                             @getsentry/fang
lib/zendesk/tickets/problem_incident.rb                                                                   @getsentry/boxoffice @getsentry/popcorn
lib/zendesk/tickets/properties.rb                                                                         @getsentry/strongbad
lib/zendesk/tickets/recent_ticket_management.rb                                                           @getsentry/boxoffice @getsentry/popcorn
lib/zendesk/tickets/recent_ticket_manager.rb                                                              @getsentry/boxoffice @getsentry/popcorn
lib/zendesk/tickets/recent_ticket_store.rb                                                                @getsentry/boxoffice @getsentry/popcorn
lib/zendesk/tickets/recoverer.rb                                                                          @getsentry/strongbad
lib/zendesk/tickets/requester_data_parser.rb                                                              @getsentry/boxoffice @getsentry/popcorn
lib/zendesk/tickets/safe_update.rb                                                                        @getsentry/teapot @getsentry/tealeaves
lib/zendesk/tickets/set_collaborators.rb                                                                  @getsentry/strongbad
lib/zendesk/tickets/set_collaborators_v2.rb                                                               @getsentry/strongbad
lib/zendesk/tickets/sms.rb                                                                                @getsentry/voice
lib/zendesk/tickets/soft_deletion.rb                                                                      @getsentry/boxoffice @getsentry/popcorn
lib/zendesk/tickets/test_ticket.rb                                                                        @getsentry/ponderosa
lib/zendesk/tickets/ticket_field_manager.rb                                                               @getsentry/boxoffice @getsentry/popcorn
lib/zendesk/tickets/ticket_field_options.rb                                                               @getsentry/boxoffice @getsentry/popcorn
lib/zendesk/tickets/unverified_email_controller_support.rb                                                @getsentry/boxoffice @getsentry/popcorn
lib/zendesk/tickets/url_builder.rb                                                                        @getsentry/boxoffice @getsentry/popcorn
lib/zendesk/tickets/v2/importer.rb                                                                        @getsentry/boxoffice @getsentry/popcorn
lib/zendesk/tickets/v2/initializer.rb                                                                     @getsentry/boxoffice @getsentry/popcorn
lib/zendesk/trial_activation.rb                                                                           @getsentry/rakali
lib/zendesk/trial_activation_state.rb                                                                     @getsentry/ngiyari @getsentry/pcc-operations
lib/zendesk/user_portal_state.rb                                                                          @getsentry/bilby @getsentry/guide-dev
lib/zendesk/user_views/                                                                                   @getsentry/penguin
lib/zendesk/users/                                                                                        @getsentry/bilby
lib/zendesk/users/agent_downgrader.rb                                                                     @getsentry/bilby
lib/zendesk/users/finder.rb                                                                               @getsentry/bilby
lib/zendesk/users/finder_with_pagination.rb                                                               @getsentry/bilby
lib/zendesk/users/rate_limiting.rb                                                                        @getsentry/boxoffice @getsentry/popcorn
lib/zendesk/voice/                                                                                        @getsentry/voice
lib/zendesk/voyager_client_builder.rb                                                                     @getsentry/views-enablement
lib/zendesk/webhook/                                                                                      @getsentry/vegemite
lib/zendesk/zd_date_time.rb                                                                               @getsentry/bolt
lib/zendesk/znowflake_http_client.rb                                                                      @getsentry/bolt
lib/zendesk/znowflake_migration.rb                                                                        @getsentry/bolt
lib/zendesk/zrn/catalogue.rb                                                                              @getsentry/vinyl
lib/zendesk_cms/stats.rb                                                                                  @getsentry/athene
lib/zopim/agent_deactivator.rb                                                                            @getsentry/bilby @getsentry/basketcases
lib/zopim/base_type.rb                                                                                    @getsentry/basketcases
lib/zopim/configuration.rb                                                                                @getsentry/basketcases
lib/zopim/internal_api_client.rb                                                                          @getsentry/teapot @getsentry/tealeaves @getsentry/basketcases
lib/zopim/reseller.rb                                                                                     @getsentry/basketcases
lib/zopim/synchronization_error.rb                                                                        @getsentry/narwhals @getsentry/otters @getsentry/basketcases
openapi/docs/operations/BulkUpdateDefaultCustomStatus.md                                                  @getsentry/boxoffice @getsentry/popcorn @getsentry/documentation
openapi/docs/operations/CreateCustomStatus.md                                                             @getsentry/boxoffice @getsentry/popcorn @getsentry/documentation
openapi/docs/operations/CreateMacro.md                                                                    @getsentry/fang @getsentry/documentation
openapi/docs/operations/CreateTicket.md                                                                   @getsentry/boxoffice @getsentry/popcorn @getsentry/documentation
openapi/docs/operations/CreateTrialAccount.md                                                             @getsentry/quoll @getsentry/documentation
openapi/docs/operations/CreateUser.md                                                                     @getsentry/bilby @getsentry/documentation
openapi/docs/operations/ListActiveMacros.md                                                               @getsentry/fang @getsentry/documentation
openapi/docs/operations/ListMacros.md                                                                     @getsentry/fang @getsentry/documentation
openapi/docs/operations/ListTickets.md                                                                    @getsentry/boxoffice @getsentry/popcorn @getsentry/documentation
openapi/docs/operations/SearchMacro.md                                                                    @getsentry/fang @getsentry/documentation
openapi/docs/operations/ShowUserRelated.md                                                                @getsentry/bilby @getsentry/documentation
openapi/docs/operations/TicketBulkImport.md                                                               @getsentry/boxoffice @getsentry/popcorn @getsentry/documentation
openapi/docs/operations/TicketsUpdateMany.md                                                              @getsentry/boxoffice @getsentry/popcorn @getsentry/documentation
openapi/docs/operations/UpdateCustomStatus.md                                                             @getsentry/boxoffice @getsentry/popcorn @getsentry/documentation
openapi/docs/operations/UpdateMacro.md                                                                    @getsentry/fang @getsentry/documentation
openapi/docs/operations/UpdateManyMacros.md                                                               @getsentry/fang @getsentry/documentation
openapi/docs/operations/UpdateManyUsers.md                                                                @getsentry/bilby @getsentry/documentation
openapi/docs/operations/UpdateTicket.md                                                                   @getsentry/boxoffice @getsentry/popcorn @getsentry/documentation
openapi/docs/operations/UpdateUser.md                                                                     @getsentry/bilby @getsentry/documentation
openapi/docs/schemas/CustomRoleObject.md                                                                  @getsentry/firefly @getsentry/documentation
openapi/docs/schemas/DynamicContentItemVariant.md                                                         @getsentry/athene @getsentry/documentation
openapi/docs/schemas/JobStatusObject.md                                                                   @getsentry/bolt @getsentry/documentation
openapi/docs/schemas/OLAPolicyObject.md                                                                   @getsentry/fang @getsentry/documentation
openapi/docs/schemas/RequestObject.md                                                                     @getsentry/boxoffice @getsentry/popcorn @getsentry/documentation
openapi/docs/schemas/SLAPolicyObject.md                                                                   @getsentry/fang @getsentry/documentation
openapi/docs/schemas/SupportAddressObject.md                                                              @getsentry/strongbad @getsentry/documentation
openapi/docs/schemas/TargetObject.md                                                                      @getsentry/vegemite @getsentry/documentation
openapi/docs/schemas/TicketCommentObject.md                                                               @getsentry/boxoffice @getsentry/popcorn @getsentry/documentation
openapi/docs/schemas/TicketFormObject.md                                                                  @getsentry/boxoffice @getsentry/popcorn @getsentry/documentation
openapi/docs/schemas/TicketMetricEventObject.md                                                           @getsentry/fang @getsentry/documentation
openapi/docs/schemas/UserForAdmin.md                                                                      @getsentry/bilby @getsentry/documentation
openapi/docs/schemas/UserIdentityObject.yaml                                                              @getsentry/bilby @getsentry/documentation
openapi/docs/schemas/ViewObject.md                                                                        @getsentry/views-core @getsentry/views-enablement @getsentry/documentation
openapi/docs/schemas/account                                                                              @getsentry/quoll @getsentry/documentation
openapi/docs/schemas/satisfaction_reasons/ReasonObject.md                                                 @getsentry/fang @getsentry/documentation
openapi/docs/schemas/tags                                                                                 @getsentry/boxoffice @getsentry/popcorn @getsentry/documentation
openapi/docs/schemas/tickets                                                                              @getsentry/boxoffice @getsentry/popcorn @getsentry/documentation
openapi/docs/schemas/triggers                                                                             @getsentry/libretto @getsentry/documentation
openapi/docs/tags/AccountSettings.md                                                                      @getsentry/bolt @getsentry/bilby @getsentry/documentation
openapi/docs/tags/AssignableGroupsAgents.md                                                               @getsentry/iris @getsentry/documentation
openapi/docs/tags/Attachments.md                                                                          @getsentry/squonk @getsentry/documentation
openapi/docs/tags/AuditLogs.md                                                                            @getsentry/audit-log @getsentry/documentation
openapi/docs/tags/Automations.md                                                                          @getsentry/libretto @getsentry/documentation
openapi/docs/tags/Bookmarks.md                                                                            @getsentry/documentation
openapi/docs/tags/Brands.md                                                                               @getsentry/boxoffice @getsentry/popcorn @getsentry/documentation
openapi/docs/tags/CustomRoles.md                                                                          @getsentry/bilby @getsentry/documentation
openapi/docs/tags/CustomStatuses.md                                                                       @getsentry/boxoffice @getsentry/popcorn @getsentry/documentation
openapi/docs/tags/DynamicContent.md                                                                       @getsentry/athene @getsentry/documentation
openapi/docs/tags/DynamicContentVariants.md                                                               @getsentry/athene @getsentry/documentation
openapi/docs/tags/EndUsers.md                                                                             @getsentry/bilby @getsentry/documentation
openapi/docs/tags/GroupMemberships.md                                                                     @getsentry/bolt @getsentry/bilby @getsentry/documentation
openapi/docs/tags/Groups.md                                                                               @getsentry/bolt @getsentry/bilby @getsentry/documentation
openapi/docs/tags/IncrementalExports.md                                                                   @getsentry/ticket-platform @getsentry/dugong @getsentry/bilby @getsentry/kowari @getsentry/documentation
openapi/docs/tags/IncrementalSkillBasedRouting.md                                                         @getsentry/argonauts @getsentry/documentation
openapi/docs/tags/JobStatuses.md                                                                          @getsentry/bolt @getsentry/documentation
openapi/docs/tags/LookupRelationships.md                                                                  @getsentry/vinyl @getsentry/documentation
openapi/docs/tags/Macros.md                                                                               @getsentry/fang @getsentry/documentation
openapi/docs/tags/OLAPolicies.md                                                                          @getsentry/fang @getsentry/documentation
openapi/docs/tags/OrganizationFields.md                                                                   @getsentry/kowari @getsentry/vinyl @getsentry/documentation
openapi/docs/tags/OrganizationMemberships.md                                                              @getsentry/kowari @getsentry/documentation
openapi/docs/tags/OrganizationSubscriptions.md                                                            @getsentry/kowari @getsentry/documentation
openapi/docs/tags/Organizations.md                                                                        @getsentry/kowari @getsentry/documentation
openapi/docs/tags/PushNotificationDevices.yaml                                                            @getsentry/lir @getsentry/documentation
openapi/docs/tags/Requests.md                                                                             @getsentry/boxoffice @getsentry/popcorn @getsentry/documentation
openapi/docs/tags/Reseller.md                                                                             @getsentry/quoll @getsentry/documentation
openapi/docs/tags/ResourceCollections.md                                                                  @getsentry/dingo @getsentry/documentation
openapi/docs/tags/SLAPolicies.md                                                                          @getsentry/fang @getsentry/documentation
openapi/docs/tags/SatisfactionRatings.md                                                                  @getsentry/fang @getsentry/documentation
openapi/docs/tags/SatisfactionReasons.md                                                                  @getsentry/fang @getsentry/documentation
openapi/docs/tags/Search.md                                                                               @getsentry/search @getsentry/documentation
openapi/docs/tags/Sessions.md                                                                             @getsentry/secdev @getsentry/documentation
openapi/docs/tags/SharingAgreements.md                                                                    @getsentry/boxoffice @getsentry/popcorn @getsentry/documentation
openapi/docs/tags/SkillBasedRouting.md                                                                    @getsentry/fang @getsentry/documentation
openapi/docs/tags/SupportAddresses.md                                                                     @getsentry/strongbad @getsentry/documentation
openapi/docs/tags/SuspendedTickets.md                                                                     @getsentry/strongbad @getsentry/documentation
openapi/docs/tags/Tags.md                                                                                 @getsentry/boxoffice @getsentry/popcorn @getsentry/documentation
openapi/docs/tags/TalkPartnerEdition.md                                                                   @getsentry/zenguins @getsentry/documentation
openapi/docs/tags/TargetFailures.md                                                                       @getsentry/vegemite @getsentry/documentation
openapi/docs/tags/Targets.md                                                                              @getsentry/vegemite @getsentry/documentation
openapi/docs/tags/TicketActivities.md                                                                     @getsentry/harrier @getsentry/documentation
openapi/docs/tags/TicketAudits.md                                                                         @getsentry/ticket-platform @getsentry/documentation
openapi/docs/tags/TicketComments.md                                                                       @getsentry/boxoffice @getsentry/popcorn @getsentry/documentation
openapi/docs/tags/TicketFields.md                                                                         @getsentry/boxoffice @getsentry/popcorn @getsentry/documentation
openapi/docs/tags/TicketForms.md                                                                          @getsentry/boxoffice @getsentry/popcorn @getsentry/documentation
openapi/docs/tags/TicketImport.md                                                                         @getsentry/boxoffice @getsentry/popcorn @getsentry/documentation
openapi/docs/tags/TicketMetricEvents.md                                                                   @getsentry/fang @getsentry/documentation
openapi/docs/tags/TicketMetrics.md                                                                        @getsentry/fang @getsentry/documentation
openapi/docs/tags/TicketSkips.md                                                                          @getsentry/argonauts @getsentry/documentation
openapi/docs/tags/Tickets.md                                                                              @getsentry/boxoffice @getsentry/popcorn @getsentry/documentation
openapi/docs/tags/TriggerCategories.md                                                                    @getsentry/libretto @getsentry/documentation
openapi/docs/tags/Triggers.md                                                                             @getsentry/libretto @getsentry/documentation
openapi/docs/tags/UserFields.md                                                                           @getsentry/bilby @getsentry/vinyl @getsentry/documentation
openapi/docs/tags/UserIdentities.md                                                                       @getsentry/bilby @getsentry/documentation
openapi/docs/tags/UserPasswords.md                                                                        @getsentry/bilby @getsentry/documentation
openapi/docs/tags/Users.md                                                                                @getsentry/bilby @getsentry/documentation
openapi/docs/tags/Views.md                                                                                @getsentry/views-core @getsentry/views-enablement @getsentry/documentation
openapi/docs/tags/Workspaces.md                                                                           @getsentry/kingfisher @getsentry/documentation
openapi/examples/AttachmentResponseExample.yaml                                                           @getsentry/squonk @getsentry/documentation
openapi/examples/AttachmentUpdateRequestExample.yaml                                                      @getsentry/spyglass @getsentry/documentation
openapi/examples/AttachmentUploadResponseExample.yaml                                                     @getsentry/squonk @getsentry/documentation
openapi/examples/AuditLogResponseExample.yaml                                                             @getsentry/audit-log @getsentry/documentation
openapi/examples/AuditLogsResponseExample.yaml                                                            @getsentry/audit-log @getsentry/documentation
openapi/examples/AutomationCreateResponseExample.yaml                                                     @getsentry/libretto @getsentry/documentation
openapi/examples/AutomationResponseExample.yaml                                                           @getsentry/libretto @getsentry/documentation
openapi/examples/AutomationsResponseExample.yaml                                                          @getsentry/libretto @getsentry/documentation
openapi/examples/AutomationsSearchResponseExample.yaml                                                    @getsentry/libretto @getsentry/documentation
openapi/examples/AutomationsUpdateManyResponseExample.yaml                                                @getsentry/libretto @getsentry/documentation
openapi/examples/BookmarkCreateRequest.yaml                                                               @getsentry/documentation
openapi/examples/BookmarkResponse.yaml                                                                    @getsentry/documentation
openapi/examples/BookmarksResponse.yaml                                                                   @getsentry/documentation
openapi/examples/BrandCreateRequestExample.yaml                                                           @getsentry/boxoffice @getsentry/popcorn @getsentry/documentation
openapi/examples/BrandResponseExample.yaml                                                                @getsentry/boxoffice @getsentry/popcorn @getsentry/documentation
openapi/examples/BrandUpdateRequestExample.yaml                                                           @getsentry/boxoffice @getsentry/popcorn @getsentry/documentation
openapi/examples/BrandsResponseExample.yaml                                                               @getsentry/boxoffice @getsentry/popcorn @getsentry/documentation
openapi/examples/ComplianceDeletionStatusesResponseExample.yaml                                           @getsentry/spyglass @getsentry/documentation
openapi/examples/CreateMacroResponseExample.yaml                                                          @getsentry/fang @getsentry/documentation
openapi/examples/CustomRoleResponseExample.yaml                                                           @getsentry/bilby @getsentry/documentation
openapi/examples/CustomRolesResponseExample.yaml                                                          @getsentry/bilby @getsentry/documentation
openapi/examples/CustomTicketFieldOptionCreateResponseExample.yaml                                        @getsentry/boxoffice @getsentry/popcorn @getsentry/documentation
openapi/examples/CustomTicketFieldOptionResponseExample.yaml                                              @getsentry/boxoffice @getsentry/popcorn @getsentry/documentation
openapi/examples/CustomTicketFieldOptionUpdateResponseExample.yaml                                        @getsentry/boxoffice @getsentry/popcorn @getsentry/documentation
openapi/examples/CustomTicketFieldOptionsResponseExample.yaml                                             @getsentry/boxoffice @getsentry/popcorn @getsentry/documentation
openapi/examples/CustomUserFieldOptionCreateResponseExample.yaml                                          @getsentry/bilby @getsentry/vinyl @getsentry/documentation
openapi/examples/CustomUserFieldOptionResponseExample.yaml                                                @getsentry/bilby @getsentry/vinyl @getsentry/documentation
openapi/examples/CustomUserFieldOptionUpdateResponseExample.yaml                                          @getsentry/bilby @getsentry/vinyl @getsentry/documentation
openapi/examples/CustomUserFieldOptionsResponseExample.yaml                                               @getsentry/bilby @getsentry/vinyl @getsentry/documentation
openapi/examples/DeleteUserResponseExample.yaml                                                           @getsentry/bilby @getsentry/documentation
openapi/examples/DeletedUserResponseExample.yaml                                                          @getsentry/bilby @getsentry/documentation
openapi/examples/DeletedUsersCountResponseExample.yaml                                                    @getsentry/bilby @getsentry/documentation
openapi/examples/DeletedUsersResponseExample.yaml                                                         @getsentry/bilby @getsentry/documentation
openapi/examples/DynamicContentResponseExample.yaml                                                       @getsentry/athene @getsentry/documentation
openapi/examples/DynamicContentUpdateResponseExample.yaml                                                 @getsentry/athene @getsentry/documentation
openapi/examples/DynamicContentVariantResponseExample.yaml                                                @getsentry/athene @getsentry/documentation
openapi/examples/DynamicContentVariantUpdateResponseExample.yaml                                          @getsentry/athene @getsentry/documentation
openapi/examples/DynamicContentVariantsCreateManyResponseExample.yaml                                     @getsentry/athene @getsentry/documentation
openapi/examples/DynamicContentVariantsResponseExample.yaml                                               @getsentry/athene @getsentry/documentation
openapi/examples/DynamicContentVariantsUpdateManyResponseExample.yaml                                     @getsentry/athene @getsentry/documentation
openapi/examples/DynamicContentsResponseExample.yaml                                                      @getsentry/athene @getsentry/documentation
openapi/examples/EndUserResponseExample.yaml                                                              @getsentry/bilby @getsentry/documentation
openapi/examples/EndUserUpdateResponseExample.yaml                                                        @getsentry/bilby @getsentry/documentation
openapi/examples/GroupCreateResponseExample.yaml                                                          @getsentry/bolt @getsentry/documentation
openapi/examples/GroupDefaultResponseExample.yaml                                                         @getsentry/bolt @getsentry/documentation
openapi/examples/GroupMembershipResponseExample.yaml                                                      @getsentry/bolt @getsentry/documentation
openapi/examples/GroupMembershipsResponseExample.yaml                                                     @getsentry/bolt @getsentry/documentation
openapi/examples/GroupResponseExample.yaml                                                                @getsentry/bolt @getsentry/documentation
openapi/examples/GroupUpdateResponseExample.yaml                                                          @getsentry/bolt @getsentry/documentation
openapi/examples/GroupsCountResponseExample.yaml                                                          @getsentry/bolt @getsentry/documentation
openapi/examples/GroupsResponseExample.yaml                                                               @getsentry/bolt @getsentry/documentation
openapi/examples/HostMappingResponseInvalidCNAMEExample.yaml                                              @getsentry/boxoffice @getsentry/popcorn @getsentry/documentation
openapi/examples/HostMappingResponseValidExample.yaml                                                     @getsentry/boxoffice @getsentry/popcorn @getsentry/documentation
openapi/examples/HostMappingResponseWrongCNAMEExample.yaml                                                @getsentry/boxoffice @getsentry/popcorn @getsentry/documentation
openapi/examples/IncrementalSkillBasedRoutingAttributeValuesExample.yaml                                  @getsentry/argonauts @getsentry/documentation
openapi/examples/IncrementalSkillBasedRoutingAttributesExample.yaml                                       @getsentry/argonauts @getsentry/documentation
openapi/examples/IncrementalSkillBasedRoutingInstanceValuesExample.yaml                                   @getsentry/argonauts @getsentry/documentation
openapi/examples/JobStatusBulkDeleteResponseExample.yaml                                                  @getsentry/bilby @getsentry/documentation
openapi/examples/JobStatusResponseExample.yaml                                                            @getsentry/bolt @getsentry/bilby @getsentry/documentation
openapi/examples/JobStatusesResponseExample.yaml                                                          @getsentry/bolt @getsentry/documentation
openapi/examples/MacroActionsResponseExample.yaml                                                         @getsentry/fang @getsentry/documentation
openapi/examples/MacroAttachmentResponseExample.yaml                                                      @getsentry/fang @getsentry/documentation
openapi/examples/MacroAttachmentsResponseExample.yaml                                                     @getsentry/fang @getsentry/documentation
openapi/examples/MacroCategoriesResponseExample.yaml                                                      @getsentry/fang @getsentry/documentation
openapi/examples/MacroChangesToTicketsResponseExample.yaml                                                @getsentry/fang @getsentry/documentation
openapi/examples/MacroResponseExample.yaml                                                                @getsentry/fang @getsentry/documentation
openapi/examples/MacrosActiveResponseExample.yaml                                                         @getsentry/fang @getsentry/documentation
openapi/examples/MacrosResponseExample.yaml                                                               @getsentry/fang @getsentry/documentation
openapi/examples/MergeEndUsersRequestExample.yaml                                                         @getsentry/bilby @getsentry/documentation
openapi/examples/MergeUserWithCurrentUserRequestExample.yaml                                              @getsentry/bilby @getsentry/documentation
openapi/examples/MergeUserWithCurrentUserResponseExample.yaml                                             @getsentry/bilby @getsentry/documentation
openapi/examples/OLAPoliciesResponseExample.yaml                                                          @getsentry/fang @getsentry/documentation
openapi/examples/OLAPolicyCreateResponse.yaml                                                             @getsentry/fang @getsentry/documentation
openapi/examples/OLAPolicyFilterDefinitionResponseExample.yaml                                            @getsentry/fang @getsentry/documentation
openapi/examples/OLAPolicyResponseExample.yaml                                                            @getsentry/fang @getsentry/documentation
openapi/examples/OLAPolicyUpdateResponseExample.yaml                                                      @getsentry/fang @getsentry/documentation
openapi/examples/OrganizationFieldCreateResponseExample.yaml                                              @getsentry/kowari @getsentry/vinyl @getsentry/documentation
openapi/examples/OrganizationFieldResponseExample.yaml                                                    @getsentry/kowari @getsentry/vinyl @getsentry/documentation
openapi/examples/OrganizationFieldUpdateResponseExample.yaml                                              @getsentry/kowari @getsentry/vinyl @getsentry/documentation
openapi/examples/OrganizationFieldsResponseExample.yaml                                                   @getsentry/kowari @getsentry/vinyl @getsentry/documentation
openapi/examples/OrganizationMembershipCreateManyResponseExample.yaml                                     @getsentry/kowari @getsentry/documentation
openapi/examples/OrganizationMembershipCreateResponseExample.yaml                                         @getsentry/kowari @getsentry/documentation
openapi/examples/OrganizationMembershipResponseExample.yaml                                               @getsentry/kowari @getsentry/documentation
openapi/examples/OrganizationMembershipsResponseExample.yaml                                              @getsentry/kowari @getsentry/documentation
openapi/examples/OrganizationSubscriptionCreateRequestExample.yaml                                        @getsentry/kowari @getsentry/documentation
openapi/examples/OrganizationSubscriptionResponseExample.yaml                                             @getsentry/kowari @getsentry/documentation
openapi/examples/OrganizationSubscriptionsResponseExample.yaml                                            @getsentry/kowari @getsentry/documentation
openapi/examples/PushNotificationDevicesRequestExample.yaml                                               @getsentry/lir @getsentry/documentation
openapi/examples/RecoverSuspendedTicketResponseExample.yaml                                               @getsentry/strongbad @getsentry/documentation
openapi/examples/RecoverSuspendedTicketsResponseExample.yaml                                              @getsentry/strongbad @getsentry/documentation
openapi/examples/RequestCreateResponseExample.yaml                                                        @getsentry/boxoffice @getsentry/popcorn @getsentry/documentation
openapi/examples/RequestGetCommentResponseExample.yaml                                                    @getsentry/boxoffice @getsentry/popcorn @getsentry/documentation
openapi/examples/RequestListCommentsResponseExample.yaml                                                  @getsentry/boxoffice @getsentry/popcorn @getsentry/documentation
openapi/examples/RequestResponseExample.yaml                                                              @getsentry/boxoffice @getsentry/popcorn @getsentry/documentation
openapi/examples/RequestUserCreateRequestExample.yaml                                                     @getsentry/bilby @getsentry/documentation
openapi/examples/RequestsResponseExample.yaml                                                             @getsentry/boxoffice @getsentry/popcorn @getsentry/documentation
openapi/examples/ResourceCollectionCreateResponseExample.yaml                                             @getsentry/dingo @getsentry/documentation
openapi/examples/ResourceCollectionDeleteResponseExample.yaml                                             @getsentry/dingo @getsentry/documentation
openapi/examples/ResourceCollectionResponseExample.yaml                                                   @getsentry/dingo @getsentry/documentation
openapi/examples/ResourceCollectionUpdateResponseExample.yaml                                             @getsentry/dingo @getsentry/documentation
openapi/examples/ResourceCollectionsResponseExample.yaml                                                  @getsentry/dingo @getsentry/documentation
openapi/examples/SLAPoliciesResponseExample.yaml                                                          @getsentry/fang @getsentry/documentation
openapi/examples/SLAPolicyCreateResponse.yaml                                                             @getsentry/fang @getsentry/documentation
openapi/examples/SLAPolicyFilterDefinitionResponseExample.yaml                                            @getsentry/fang @getsentry/documentation
openapi/examples/SLAPolicyResponseExample.yaml                                                            @getsentry/fang @getsentry/documentation
openapi/examples/SLAPolicyUpdateResponseExample.yaml                                                      @getsentry/fang @getsentry/documentation
openapi/examples/SatisfactionRatingResponseExample.yaml                                                   @getsentry/fang @getsentry/documentation
openapi/examples/SatisfactionRatingsCountResponseExample.yaml                                             @getsentry/fang @getsentry/documentation
openapi/examples/SatisfactionRatingsResponseExample.yaml                                                  @getsentry/fang @getsentry/documentation
openapi/examples/SatisfactionReasonResponseExample.yaml                                                   @getsentry/fang @getsentry/documentation
openapi/examples/SatisfactionReasonsResponseExample.yaml                                                  @getsentry/fang @getsentry/documentation
openapi/examples/SearchUsersResponseExample.yaml                                                          @getsentry/bilby @getsentry/documentation
openapi/examples/SharingAgreementCreateResponseExample.yaml                                               @getsentry/boxoffice @getsentry/popcorn @getsentry/documentation
openapi/examples/SharingAgreementResponseExample.yaml                                                     @getsentry/boxoffice @getsentry/popcorn @getsentry/documentation
openapi/examples/SharingAgreementUpdateResponseExample.yaml                                               @getsentry/boxoffice @getsentry/popcorn @getsentry/documentation
openapi/examples/SharingAgreementsResponseExample.yaml                                                    @getsentry/boxoffice @getsentry/popcorn @getsentry/documentation
openapi/examples/ShowDerivedMacroResponseExample.yaml                                                     @getsentry/fang @getsentry/documentation
openapi/examples/ShowJobStatusResponseExample.yaml                                                        @getsentry/bolt @getsentry/documentation
openapi/examples/ShowManyUsersResponseExample.yaml                                                        @getsentry/bilby @getsentry/documentation
openapi/examples/SkillBasedRoutingAttributeCreateResponseExample.yaml                                     @getsentry/fang @getsentry/documentation
openapi/examples/SkillBasedRoutingAttributeDefinitionsExample.yaml                                        @getsentry/fang @getsentry/documentation
openapi/examples/SkillBasedRoutingAttributeResponseExample.yaml                                           @getsentry/fang @getsentry/documentation
openapi/examples/SkillBasedRoutingAttributeUpdateResponseExample.yaml                                     @getsentry/fang @getsentry/documentation
openapi/examples/SkillBasedRoutingAttributeValueCreateResponseExample.yaml                                @getsentry/fang @getsentry/documentation
openapi/examples/SkillBasedRoutingAttributeValueResponseExample.yaml                                      @getsentry/fang @getsentry/documentation
openapi/examples/SkillBasedRoutingAttributeValueUpdateResponseExample.yaml                                @getsentry/fang @getsentry/documentation
openapi/examples/SkillBasedRoutingAttributeValuesResponseExample.yaml                                     @getsentry/fang @getsentry/documentation
openapi/examples/SkillBasedRoutingAttributesResponseExample.yaml                                          @getsentry/fang @getsentry/documentation
openapi/examples/SkillBasedRoutingTicketAttributesResponseExample.yaml                                    @getsentry/fang @getsentry/documentation
openapi/examples/SkillBasedRoutingTicketFulfilledResponseExample.yaml                                     @getsentry/fang @getsentry/documentation
openapi/examples/SupportAddressCreateResponseExample.yaml                                                 @getsentry/strongbad @getsentry/documentation
openapi/examples/SupportAddressResponseExample.yaml                                                       @getsentry/strongbad @getsentry/documentation
openapi/examples/SupportAddressUpdateResponseExample.yaml                                                 @getsentry/strongbad @getsentry/documentation
openapi/examples/SupportAddressesResponseExample.yaml                                                     @getsentry/strongbad @getsentry/documentation
openapi/examples/SuspendedTicketResponseExample.yaml                                                      @getsentry/strongbad @getsentry/documentation
openapi/examples/SuspendedTicketsResponseExample.yaml                                                     @getsentry/strongbad @getsentry/documentation
openapi/examples/TargetCreateResponseExample.yaml                                                         @getsentry/vegemite @getsentry/documentation
openapi/examples/TargetFailureResponseExample.yaml                                                        @getsentry/vegemite @getsentry/documentation
openapi/examples/TargetFailuresResponseExample.yaml                                                       @getsentry/vegemite @getsentry/documentation
openapi/examples/TargetResponseExample.yaml                                                               @getsentry/vegemite @getsentry/documentation
openapi/examples/TargetUpdateResponseExample.yaml                                                         @getsentry/vegemite @getsentry/documentation
openapi/examples/TargetsResponseExample.yaml                                                              @getsentry/vegemite @getsentry/documentation
openapi/examples/TicketAuditResponseExample.yaml                                                          @getsentry/ticket-platform @getsentry/documentation
openapi/examples/TicketAuditsCountResponseExample.yaml                                                    @getsentry/ticket-platform @getsentry/documentation
openapi/examples/TicketAuditsForTicketResponseExample.yaml                                                @getsentry/ticket-platform @getsentry/documentation
openapi/examples/TicketAuditsResponseExample.yaml                                                         @getsentry/ticket-platform @getsentry/documentation
openapi/examples/TicketBulkImportRequestExample.yaml                                                      @getsentry/boxoffice @getsentry/popcorn @getsentry/documentation
openapi/examples/TicketChatCommentAttachmentRedactionResponseExample.yaml                                 @getsentry/orchid @getsentry/documentation
openapi/examples/TicketChatCommentRedactionResponseExample.yaml                                           @getsentry/orchid @getsentry/documentation
openapi/examples/TicketCommentRedactionInAgentWorkspaceResponseExample.yaml                               @getsentry/orchid @getsentry/documentation
openapi/examples/TicketCommentStringRedactResponseExample.yaml                                            @getsentry/boxoffice @getsentry/popcorn @getsentry/documentation
openapi/examples/TicketCommentsResponseExample.yaml                                                       @getsentry/boxoffice @getsentry/popcorn @getsentry/documentation
openapi/examples/TicketFieldCountResponseExample.yaml                                                     @getsentry/boxoffice @getsentry/popcorn @getsentry/documentation
openapi/examples/TicketFieldResponseExample.yaml                                                          @getsentry/boxoffice @getsentry/popcorn @getsentry/documentation
openapi/examples/TicketFieldUpdateResponseExample.yaml                                                    @getsentry/boxoffice @getsentry/popcorn @getsentry/documentation
openapi/examples/TicketFieldsResponseExample.yaml                                                         @getsentry/boxoffice @getsentry/popcorn @getsentry/documentation
openapi/examples/TicketFormCreateResponseExample.yaml                                                     @getsentry/boxoffice @getsentry/popcorn @getsentry/documentation
openapi/examples/TicketFormResponseExample.yaml                                                           @getsentry/boxoffice @getsentry/popcorn @getsentry/documentation
openapi/examples/TicketFormUpdateResponseExample.yaml                                                     @getsentry/boxoffice @getsentry/popcorn @getsentry/documentation
openapi/examples/TicketFormsResponseExample.yaml                                                          @getsentry/boxoffice @getsentry/popcorn @getsentry/documentation
openapi/examples/TicketImportRequestExample.yaml                                                          @getsentry/boxoffice @getsentry/popcorn @getsentry/documentation
openapi/examples/TicketMetricEventsResponseExample.yaml                                                   @getsentry/fang @getsentry/documentation
openapi/examples/TicketMetricResponseExample.yaml                                                         @getsentry/fang @getsentry/documentation
openapi/examples/TicketMetricsResponseExample.yaml                                                        @getsentry/fang @getsentry/documentation
openapi/examples/TicketSkipCreationExample.yaml                                                           @getsentry/argonauts @getsentry/documentation
openapi/examples/TicketSkipResponseExample.yaml                                                           @getsentry/argonauts @getsentry/documentation
openapi/examples/UpdateMacroResponseExample.yaml                                                          @getsentry/fang @getsentry/documentation
openapi/examples/UpdateManyUsersRequestExample.yaml                                                       @getsentry/bilby @getsentry/documentation
openapi/examples/UpdateUserRequestExample.yaml                                                            @getsentry/bilby @getsentry/documentation
openapi/examples/UpdateUserResponseExample.yaml                                                           @getsentry/bilby @getsentry/documentation
openapi/examples/UserCountResponseExample.yaml                                                            @getsentry/bilby @getsentry/documentation
openapi/examples/UserCreateResponseExample.yaml                                                           @getsentry/bilby @getsentry/documentation
openapi/examples/UserFieldCreateResponseExample.yaml                                                      @getsentry/bilby @getsentry/vinyl @getsentry/documentation
openapi/examples/UserFieldResponseExample.yaml                                                            @getsentry/bilby @getsentry/vinyl @getsentry/documentation
openapi/examples/UserFieldUpdateResponseExample.yaml                                                      @getsentry/bilby @getsentry/vinyl @getsentry/documentation
openapi/examples/UserFieldsResponseExample.yaml                                                           @getsentry/bilby @getsentry/vinyl @getsentry/documentation
openapi/examples/UserIdentitiesResponseExample.yaml                                                       @getsentry/bilby @getsentry/documentation
openapi/examples/UserIdentityCreateResponseExample.yaml                                                   @getsentry/bilby @getsentry/documentation
openapi/examples/UserIdentityResponseExample.yaml                                                         @getsentry/bilby @getsentry/documentation
openapi/examples/UserIdentityUpdateResponseExample.yaml                                                   @getsentry/bilby @getsentry/documentation
openapi/examples/UserPasswordRequirementsResponseExample.yaml                                             @getsentry/bilby @getsentry/documentation
openapi/examples/UserRelatedResponseExample.yaml                                                          @getsentry/bilby @getsentry/documentation
openapi/examples/UserRequestExample.yaml                                                                  @getsentry/bilby @getsentry/documentation
openapi/examples/UserResponseExample.yaml                                                                 @getsentry/bilby @getsentry/documentation
openapi/examples/UsersCreateManyRequestExample.yaml                                                       @getsentry/bilby @getsentry/documentation
openapi/examples/UsersRequestExample.yaml                                                                 @getsentry/bilby @getsentry/documentation
openapi/examples/UsersResponseExample.yaml                                                                @getsentry/bilby @getsentry/documentation
openapi/examples/ViewCountResponseExample.yaml                                                            @getsentry/views-core @getsentry/views-enablement @getsentry/documentation
openapi/examples/ViewCountsResponseExample.yaml                                                           @getsentry/views-core @getsentry/views-enablement @getsentry/documentation
openapi/examples/ViewCreateResponseExample.yaml                                                           @getsentry/views-core @getsentry/views-enablement @getsentry/documentation
openapi/examples/ViewExecuteResponseExample.yaml                                                          @getsentry/views-core @getsentry/views-enablement @getsentry/documentation
openapi/examples/ViewExportResponseExample.yaml                                                           @getsentry/views-core @getsentry/views-enablement @getsentry/documentation
openapi/examples/ViewListTicketsResponseExample.yaml                                                      @getsentry/views-core @getsentry/views-enablement @getsentry/documentation
openapi/examples/ViewPreviewResponseExample.yaml                                                          @getsentry/views-core @getsentry/views-enablement @getsentry/documentation
openapi/examples/ViewResponseExample.yaml                                                                 @getsentry/views-core @getsentry/views-enablement @getsentry/documentation
openapi/examples/ViewUpdateResponseExample.yaml                                                           @getsentry/views-core @getsentry/views-enablement @getsentry/documentation
openapi/examples/ViewsActiveResponseExample.yaml                                                          @getsentry/views-core @getsentry/views-enablement @getsentry/documentation
openapi/examples/ViewsResponseExample.yaml                                                                @getsentry/views-core @getsentry/views-enablement @getsentry/documentation
openapi/examples/ViewsUpdateManyResponseExample.yaml                                                      @getsentry/views-core @getsentry/views-enablement @getsentry/documentation
openapi/examples/account                                                                                  @getsentry/quoll @getsentry/documentation
openapi/examples/accounts                                                                                 @getsentry/quoll @getsentry/documentation
openapi/examples/activities                                                                               @getsentry/harrier @getsentry/documentation
openapi/examples/assignables                                                                              @getsentry/iris
openapi/examples/custom_statuses                                                                          @getsentry/boxoffice @getsentry/popcorn @getsentry/documentation
openapi/examples/incremental_exports                                                                      @getsentry/ticket-platform @getsentry/dugong @getsentry/bilby @getsentry/kowari @getsentry/documentation
openapi/examples/organizations                                                                            @getsentry/kowari @getsentry/documentation
openapi/examples/relationship_filter                                                                      @getsentry/vinyl @getsentry/documentation
openapi/examples/search                                                                                   @getsentry/search @getsentry/documentation
openapi/examples/sessions                                                                                 @getsentry/secdev @getsentry/documentation
openapi/examples/tags                                                                                     @getsentry/boxoffice @getsentry/popcorn @getsentry/documentation
openapi/examples/tickets/ListDeletedTicketsResponseExample.yaml                                           @getsentry/boxoffice @getsentry/popcorn @getsentry/documentation
openapi/examples/tickets/ListTicketCollaboratorsResponseExample.yaml                                      @getsentry/strongbad @getsentry/documentation
openapi/examples/tickets/ListTicketEmailCCsResponseExample.yaml                                           @getsentry/strongbad @getsentry/documentation
openapi/examples/tickets/ListTicketFollowersResponseExample.yaml                                          @getsentry/strongbad @getsentry/documentation
openapi/examples/tickets/ListTicketIncidentsResponseExample.yaml                                          @getsentry/boxoffice @getsentry/popcorn @getsentry/documentation
openapi/examples/tickets/ListTicketProblemsResponseExample.yaml                                           @getsentry/boxoffice @getsentry/popcorn @getsentry/documentation
openapi/examples/tickets/PermanentlyDeleteTicketJobStatusResponseExample.yaml                             @getsentry/boxoffice @getsentry/popcorn @getsentry/documentation
openapi/examples/tickets/TicketCommentsCountResponseExample.yaml                                          @getsentry/boxoffice @getsentry/popcorn @getsentry/documentation
openapi/examples/tickets/TicketCreateRequestExample.yaml                                                  @getsentry/boxoffice @getsentry/popcorn @getsentry/documentation
openapi/examples/tickets/TicketCreateTicketViaTalkRequestExample.yaml                                     @getsentry/zenguins @getsentry/documentation
openapi/examples/tickets/TicketMergeInputExample.yaml                                                     @getsentry/boxoffice @getsentry/popcorn @getsentry/documentation
openapi/examples/tickets/TicketRelatedInformationExample.yaml                                             @getsentry/boxoffice @getsentry/popcorn @getsentry/documentation
openapi/examples/tickets/TicketResponseExample.yaml                                                       @getsentry/boxoffice @getsentry/popcorn @getsentry/documentation
openapi/examples/tickets/TicketUpdateRequestExample.yaml                                                  @getsentry/boxoffice @getsentry/popcorn @getsentry/documentation
openapi/examples/tickets/TicketUpdateResponseExample.yaml                                                 @getsentry/boxoffice @getsentry/popcorn @getsentry/documentation
openapi/examples/tickets/TicketsCreateRequestExample.yaml                                                 @getsentry/boxoffice @getsentry/popcorn @getsentry/documentation
openapi/examples/tickets/TicketsResponseExample.yaml                                                      @getsentry/boxoffice @getsentry/popcorn @getsentry/documentation
openapi/examples/triggers                                                                                 @getsentry/libretto @getsentry/documentation
openapi/examples/views/ViewsCountResponseExample.yaml                                                     @getsentry/boxoffice @getsentry/popcorn @getsentry/documentation
openapi/oas-2.yaml                                                                                        @getsentry/redback @getsentry/documentation
openapi/paths/lotus/assignables                                                                           @getsentry/iris
openapi/paths/v2/account                                                                                  @getsentry/quoll @getsentry/documentation
openapi/paths/v2/activities                                                                               @getsentry/harrier @getsentry/documentation
openapi/paths/v2/attachments/attachment_by_attachment_id.yaml                                             @getsentry/squonk @getsentry/documentation
openapi/paths/v2/audit_logs                                                                               @getsentry/audit-log @getsentry/documentation
openapi/paths/v2/automations/active_automations.yaml                                                      @getsentry/libretto @getsentry/documentation
openapi/paths/v2/automations/automation_by_automation_id.yaml                                             @getsentry/libretto @getsentry/documentation
openapi/paths/v2/automations/automations.yaml                                                             @getsentry/libretto @getsentry/documentation
openapi/paths/v2/automations/bulk_delete_automations.yaml                                                 @getsentry/libretto @getsentry/documentation
openapi/paths/v2/automations/search_automations.yaml                                                      @getsentry/libretto @getsentry/documentation
openapi/paths/v2/automations/update_many_automations.yaml                                                 @getsentry/libretto @getsentry/documentation
openapi/paths/v2/bookmarks/bookmarks.yaml                                                                 @getsentry/documentation
openapi/paths/v2/bookmarks/bookmarks_by_bookmark_id.yaml                                                  @getsentry/documentation
openapi/paths/v2/brands/brands.yaml                                                                       @getsentry/boxoffice @getsentry/popcorn @getsentry/documentation
openapi/paths/v2/brands/brands_by_brand_id.yaml                                                           @getsentry/boxoffice @getsentry/popcorn @getsentry/documentation
openapi/paths/v2/brands/brands_by_brand_id_check_host_mapping.yaml                                        @getsentry/boxoffice @getsentry/popcorn @getsentry/documentation
openapi/paths/v2/brands/brands_check_host_mapping.yaml                                                    @getsentry/boxoffice @getsentry/popcorn @getsentry/documentation
openapi/paths/v2/channels/                                                                                @getsentry/zenguins @getsentry/documentation
openapi/paths/v2/custom_roles/custom_role_by_custom_role_id.yaml                                          @getsentry/firefly @getsentry/documentation
openapi/paths/v2/custom_roles/custom_roles.yaml                                                           @getsentry/firefly @getsentry/documentation
openapi/paths/v2/custom_statuses                                                                          @getsentry/boxoffice @getsentry/popcorn @getsentry/documentation
openapi/paths/v2/deleted_tickets/deleted_tickets_by_ticket_id.yaml                                        @getsentry/boxoffice @getsentry/popcorn @getsentry/documentation
openapi/paths/v2/deleted_tickets/deleted_tickets_by_ticket_id_restore.yaml                                @getsentry/boxoffice @getsentry/popcorn @getsentry/documentation
openapi/paths/v2/deleted_tickets/deleted_tickets_destroy_many.yaml                                        @getsentry/boxoffice @getsentry/popcorn @getsentry/documentation
openapi/paths/v2/deleted_tickets/deleted_tickets_restore_many.yaml                                        @getsentry/boxoffice @getsentry/popcorn @getsentry/documentation
openapi/paths/v2/dynamic_content/dynamic_content_item_by_id.yaml                                          @getsentry/athene @getsentry/documentation
openapi/paths/v2/dynamic_content/dynamic_content_variant_by_id.yaml                                       @getsentry/athene @getsentry/documentation
openapi/paths/v2/dynamic_content/dynamic_content_variants.yaml                                            @getsentry/athene @getsentry/documentation
openapi/paths/v2/dynamic_content/dynamic_content_variants_create_many.yaml                                @getsentry/athene @getsentry/documentation
openapi/paths/v2/dynamic_content/dynamic_content_variants_update_many.yaml                                @getsentry/athene @getsentry/documentation
openapi/paths/v2/dynamic_content/dynamic_contents.yaml                                                    @getsentry/athene @getsentry/documentation
openapi/paths/v2/dynamic_content/dynamic_contents_show_may.yaml                                           @getsentry/athene @getsentry/documentation
openapi/paths/v2/end_users/end_user_by_end_user_id.yaml                                                   @getsentry/bilby @getsentry/documentation
openapi/paths/v2/group_memberships                                                                        @getsentry/bolt @getsentry/documentation
openapi/paths/v2/groups/default_group.yaml                                                                @getsentry/bolt @getsentry/documentation
openapi/paths/v2/groups/group_by_group_id.yaml                                                            @getsentry/bolt @getsentry/documentation
openapi/paths/v2/groups/groups.yaml                                                                       @getsentry/bolt @getsentry/documentation
openapi/paths/v2/groups/groups_count.yaml                                                                 @getsentry/bolt @getsentry/documentation
openapi/paths/v2/groups/groups_list_assignable.yaml                                                       @getsentry/bolt @getsentry/documentation
openapi/paths/v2/imports/imports_tickets.yaml                                                             @getsentry/boxoffice @getsentry/popcorn @getsentry/documentation
openapi/paths/v2/imports/imports_tickets_create_many.yaml                                                 @getsentry/boxoffice @getsentry/popcorn @getsentry/documentation
openapi/paths/v2/incremental/incremental_ticket_metric_events.yaml                                        @getsentry/fang @getsentry/documentation
openapi/paths/v2/incremental/skill_based_routing_attribute_values_export.yaml                             @getsentry/argonauts @getsentry/documentation
openapi/paths/v2/incremental/skill_based_routing_attributes_export.yaml                                   @getsentry/argonauts @getsentry/documentation
openapi/paths/v2/incremental/skill_based_routing_instance_values_export.yaml                              @getsentry/argonauts @getsentry/documentation
openapi/paths/v2/incremental_exports                                                                      @getsentry/ticket-platform @getsentry/dugong @getsentry/bilby @getsentry/kowari @getsentry/documentation
openapi/paths/v2/job_statuses/job_status_by_job_status_id.yaml                                            @getsentry/bolt @getsentry/documentation
openapi/paths/v2/job_statuses/job_statuses.yaml                                                           @getsentry/bolt @getsentry/documentation
openapi/paths/v2/job_statuses/show_many_job_statuses.yaml                                                 @getsentry/bolt @getsentry/documentation
openapi/paths/v2/macros/active_macros.yaml                                                                @getsentry/fang @getsentry/documentation
openapi/paths/v2/macros/apply_macros_by_id.yaml                                                           @getsentry/fang @getsentry/documentation
openapi/paths/v2/macros/destroy_many_macros.yaml                                                          @getsentry/fang @getsentry/documentation
openapi/paths/v2/macros/macros.yaml                                                                       @getsentry/fang @getsentry/documentation
openapi/paths/v2/macros/macros_actions.yaml                                                               @getsentry/fang @getsentry/documentation
openapi/paths/v2/macros/macros_attachments.yaml                                                           @getsentry/fang @getsentry/documentation
openapi/paths/v2/macros/macros_attachments_by_id.yaml                                                     @getsentry/fang @getsentry/documentation
openapi/paths/v2/macros/macros_by_id.yaml                                                                 @getsentry/fang @getsentry/documentation
openapi/paths/v2/macros/macros_by_id_attachments.yaml                                                     @getsentry/fang @getsentry/documentation
openapi/paths/v2/macros/macros_categories.yaml                                                            @getsentry/fang @getsentry/documentation
openapi/paths/v2/macros/macros_definitions.yaml                                                           @getsentry/fang @getsentry/documentation
openapi/paths/v2/macros/macros_new.yaml                                                                   @getsentry/fang @getsentry/documentation
openapi/paths/v2/macros/macros_search.yaml                                                                @getsentry/fang @getsentry/documentation
openapi/paths/v2/macros/tickets_by_ticket_id_apply_macros_by_id.yaml                                      @getsentry/fang @getsentry/documentation
openapi/paths/v2/macros/update_many_macros.yaml                                                           @getsentry/fang @getsentry/documentation
openapi/paths/v2/olas                                                                                     @getsentry/fang @getsentry/documentation
openapi/paths/v2/organization_fields                                                                      @getsentry/kowari @getsentry/vinyl @getsentry/documentation
openapi/paths/v2/organization_memberships                                                                 @getsentry/kowari @getsentry/documentation
openapi/paths/v2/organization_subscriptions/                                                              @getsentry/kowari @getsentry/documentation
openapi/paths/v2/organizations                                                                            @getsentry/kowari @getsentry/documentation
openapi/paths/v2/problems/problems.yaml                                                                   @getsentry/boxoffice @getsentry/popcorn @getsentry/documentation
openapi/paths/v2/problems/problems_autocomplete.yaml                                                      @getsentry/boxoffice @getsentry/popcorn @getsentry/documentation
openapi/paths/v2/push_notification_devices/push_notification_devices_destroy_many.yaml                    @getsentry/lir @getsentry/documentation
openapi/paths/v2/recipient_addresses                                                                      @getsentry/strongbad @getsentry/documentation
openapi/paths/v2/relationships                                                                            @getsentry/vinyl @getsentry/documentation
openapi/paths/v2/requests                                                                                 @getsentry/boxoffice @getsentry/popcorn @getsentry/documentation
openapi/paths/v2/reseller                                                                                 @getsentry/quoll @getsentry/documentation
openapi/paths/v2/resource_collections                                                                     @getsentry/dingo @getsentry/documentation
openapi/paths/v2/routing                                                                                  @getsentry/fang @getsentry/documentation
openapi/paths/v2/satisfaction_ratings/satisfaction_ratings.yaml                                           @getsentry/fang @getsentry/documentation
openapi/paths/v2/satisfaction_ratings/satisfaction_ratings_by_id.yaml                                     @getsentry/fang @getsentry/documentation
openapi/paths/v2/satisfaction_ratings/satisfaction_ratings_count.yaml                                     @getsentry/fang @getsentry/documentation
openapi/paths/v2/satisfaction_reasons/satisfaction_rating_reason_by_id.yaml                               @getsentry/fang @getsentry/documentation
openapi/paths/v2/satisfaction_reasons/satisfaction_rating_reasons.yaml                                    @getsentry/fang @getsentry/documentation
openapi/paths/v2/search                                                                                   @getsentry/search @getsentry/documentation
openapi/paths/v2/sessions                                                                                 @getsentry/secdev @getsentry/documentation
openapi/paths/v2/sharing_agreements                                                                       @getsentry/boxoffice @getsentry/popcorn @getsentry/documentation
openapi/paths/v2/slas                                                                                     @getsentry/fang @getsentry/documentation
openapi/paths/v2/suspended_tickets                                                                        @getsentry/strongbad @getsentry/documentation
openapi/paths/v2/tags                                                                                     @getsentry/boxoffice @getsentry/popcorn @getsentry/documentation
openapi/paths/v2/target_failures/target_failure_by_target_failure_id.yaml                                 @getsentry/vegemite @getsentry/documentation
openapi/paths/v2/target_failures/target_failures.yaml                                                     @getsentry/vegemite @getsentry/documentation
openapi/paths/v2/targets/target_by_target_id.yaml                                                         @getsentry/vegemite @getsentry/documentation
openapi/paths/v2/targets/targets.yaml                                                                     @getsentry/vegemite @getsentry/documentation
openapi/paths/v2/ticket_audits/ticket_audits.yaml                                                         @getsentry/ticket-platform @getsentry/documentation
openapi/paths/v2/ticket_fields                                                                            @getsentry/boxoffice @getsentry/popcorn @getsentry/vinyl @getsentry/documentation
openapi/paths/v2/ticket_forms                                                                             @getsentry/boxoffice @getsentry/popcorn @getsentry/documentation
openapi/paths/v2/ticket_metrics/ticket_metrics.yaml                                                       @getsentry/fang @getsentry/documentation
openapi/paths/v2/ticket_metrics/ticket_metrics_by_ticket_metric_id.yaml                                   @getsentry/fang @getsentry/documentation
openapi/paths/v2/ticket_skips/ticket_skip_creation.yaml                                                   @getsentry/argonauts @getsentry/documentation
openapi/paths/v2/ticket_skips/ticket_skips.yaml                                                           @getsentry/argonauts @getsentry/documentation
openapi/paths/v2/tickets/make_comment_private.yaml                                                        @getsentry/ticket-platform @getsentry/documentation
openapi/paths/v2/tickets/make_ticket_comment_private.yaml                                                 @getsentry/boxoffice @getsentry/popcorn @getsentry/documentation
openapi/paths/v2/tickets/redact_chat_attachment.yaml                                                      @getsentry/orchid @getsentry/documentation
openapi/paths/v2/tickets/redact_chat_comment.yaml                                                         @getsentry/orchid @getsentry/documentation
openapi/paths/v2/tickets/redact_comment_attachment.yaml                                                   @getsentry/squonk @getsentry/documentation
openapi/paths/v2/tickets/redact_comment_in_agent_workspace.yaml                                           @getsentry/orchid @getsentry/documentation
openapi/paths/v2/tickets/redact_ticket_comment.yaml                                                       @getsentry/boxoffice @getsentry/popcorn @getsentry/documentation
openapi/paths/v2/tickets/satisfaction_rating_creation.yaml                                                @getsentry/fang @getsentry/documentation
openapi/paths/v2/tickets/ticket_audit_by_id.yaml                                                          @getsentry/ticket-platform @getsentry/documentation
openapi/paths/v2/tickets/ticket_audits.yaml                                                               @getsentry/ticket-platform @getsentry/documentation
openapi/paths/v2/tickets/ticket_audits_count.yaml                                                         @getsentry/ticket-platform @getsentry/documentation
openapi/paths/v2/tickets/ticket_comments.yaml                                                             @getsentry/boxoffice @getsentry/popcorn @getsentry/documentation
openapi/paths/v2/tickets/ticket_comments_count.yaml                                                       @getsentry/boxoffice @getsentry/popcorn @getsentry/documentation
openapi/paths/v2/tickets/tickets.yaml                                                                     @getsentry/boxoffice @getsentry/popcorn @getsentry/documentation
openapi/paths/v2/tickets/tickets_by_ticket_id.yaml                                                        @getsentry/boxoffice @getsentry/popcorn @getsentry/documentation
openapi/paths/v2/tickets/tickets_by_ticket_id_collaborators.yaml                                          @getsentry/strongbad @getsentry/documentation
openapi/paths/v2/tickets/tickets_by_ticket_id_email_ccs.yaml                                              @getsentry/strongbad @getsentry/documentation
openapi/paths/v2/tickets/tickets_by_ticket_id_followers.yaml                                              @getsentry/strongbad @getsentry/documentation
openapi/paths/v2/tickets/tickets_by_ticket_id_incidents.yaml                                              @getsentry/boxoffice @getsentry/popcorn @getsentry/documentation
openapi/paths/v2/tickets/tickets_by_ticket_id_mark_as_spam.yaml                                           @getsentry/boxoffice @getsentry/popcorn @getsentry/documentation
openapi/paths/v2/tickets/tickets_by_ticket_id_merge.yaml                                                  @getsentry/boxoffice @getsentry/popcorn @getsentry/documentation
openapi/paths/v2/tickets/tickets_by_ticket_id_related.yaml                                                @getsentry/boxoffice @getsentry/popcorn @getsentry/documentation
openapi/paths/v2/tickets/tickets_count.yaml                                                               @getsentry/boxoffice @getsentry/popcorn @getsentry/documentation
openapi/paths/v2/tickets/tickets_create_many.yaml                                                         @getsentry/boxoffice @getsentry/popcorn @getsentry/documentation
openapi/paths/v2/tickets/tickets_deleted_tickets.yaml                                                     @getsentry/boxoffice @getsentry/popcorn @getsentry/documentation
openapi/paths/v2/tickets/tickets_destroy_many.yaml                                                        @getsentry/boxoffice @getsentry/popcorn @getsentry/documentation
openapi/paths/v2/tickets/tickets_mark_many_as_spam.yaml                                                   @getsentry/boxoffice @getsentry/popcorn @getsentry/documentation
openapi/paths/v2/tickets/tickets_show_many.yaml                                                           @getsentry/boxoffice @getsentry/popcorn @getsentry/documentation
openapi/paths/v2/tickets/tickets_update_many.yaml                                                         @getsentry/boxoffice @getsentry/popcorn @getsentry/documentation
openapi/paths/v2/trigger_categories                                                                       @getsentry/libretto @getsentry/documentation
openapi/paths/v2/triggers                                                                                 @getsentry/libretto @getsentry/documentation
openapi/paths/v2/uploads/delete_upload.yaml                                                               @getsentry/squonk @getsentry/documentation
openapi/paths/v2/uploads/upload_files.yaml                                                                @getsentry/squonk @getsentry/documentation
openapi/paths/v2/user_fields                                                                              @getsentry/bilby @getsentry/vinyl @getsentry/documentation
openapi/paths/v2/users/autocomplete_users.yaml                                                            @getsentry/bilby @getsentry/documentation
openapi/paths/v2/users/create_many_users.yaml                                                             @getsentry/bilby @getsentry/documentation
openapi/paths/v2/users/create_or_update_many_users.yaml                                                   @getsentry/bilby @getsentry/documentation
openapi/paths/v2/users/create_or_update_user.yaml                                                         @getsentry/bilby @getsentry/documentation
openapi/paths/v2/users/current_user.yaml                                                                  @getsentry/bilby @getsentry/documentation
openapi/paths/v2/users/deleted_user_by_deleted_user_id.yaml                                               @getsentry/bilby @getsentry/documentation
openapi/paths/v2/users/deleted_users.yaml                                                                 @getsentry/bilby @getsentry/documentation
openapi/paths/v2/users/deleted_users_count.yaml                                                           @getsentry/bilby @getsentry/documentation
openapi/paths/v2/users/destroy_many_users.yaml                                                            @getsentry/bilby @getsentry/documentation
openapi/paths/v2/users/logout_many_users.yaml                                                             @getsentry/secdev @getsentry/documentation
openapi/paths/v2/users/make_user_identity_primary.yaml                                                    @getsentry/bilby @getsentry/documentation
openapi/paths/v2/users/merge_end_users.yaml                                                               @getsentry/bilby @getsentry/documentation
openapi/paths/v2/users/merge_user_with_current_user.yaml                                                  @getsentry/bilby @getsentry/documentation
openapi/paths/v2/users/organization_membership_make_default.yaml                                          @getsentry/bilby @getsentry/documentation
openapi/paths/v2/users/organizations_make_default.yaml                                                    @getsentry/bilby @getsentry/kowari @getsentry/documentation
openapi/paths/v2/users/organizations_unassign.yaml                                                        @getsentry/bilby @getsentry/kowari @getsentry/documentation
openapi/paths/v2/users/request_user_create.yaml                                                           @getsentry/bilby @getsentry/documentation
openapi/paths/v2/users/request_user_verification.yaml                                                     @getsentry/bilby @getsentry/documentation
openapi/paths/v2/users/search_users.yaml                                                                  @getsentry/bilby @getsentry/documentation
openapi/paths/v2/users/set_user_password.yaml                                                             @getsentry/bilby @getsentry/documentation
openapi/paths/v2/users/show_many_users.yaml                                                               @getsentry/bilby @getsentry/documentation
openapi/paths/v2/users/update_many_users.yaml                                                             @getsentry/bilby @getsentry/documentation
openapi/paths/v2/users/user_by_user_id.yaml                                                               @getsentry/bilby @getsentry/documentation
openapi/paths/v2/users/user_by_user_id_related.yaml                                                       @getsentry/bilby @getsentry/documentation
openapi/paths/v2/users/user_compliance_deletion_statuses.yaml                                             @getsentry/spyglass @getsentry/documentation
openapi/paths/v2/users/user_identities.yaml                                                               @getsentry/bilby @getsentry/documentation
openapi/paths/v2/users/user_identity_by_id.yaml                                                           @getsentry/bilby @getsentry/documentation
openapi/paths/v2/users/user_password_requirements.yaml                                                    @getsentry/bilby @getsentry/documentation
openapi/paths/v2/users/users.yaml                                                                         @getsentry/bilby @getsentry/documentation
openapi/paths/v2/users/users_count.yaml                                                                   @getsentry/bilby @getsentry/documentation
openapi/paths/v2/users/verify_user_identity.yaml                                                          @getsentry/bilby @getsentry/documentation
openapi/paths/v2/views                                                                                    @getsentry/views-core @getsentry/views-enablement @getsentry/documentation
openapi/paths/v2/workspaces/workspaces.yaml                                                               @getsentry/kingfisher @getsentry/documentation
openapi/paths/v2/workspaces/workspaces_by_workspace_id.yaml                                               @getsentry/kingfisher @getsentry/documentation
openapi/paths/v2/workspaces/workspaces_destroy_many.yaml                                                  @getsentry/kingfisher @getsentry/documentation
openapi/paths/v2/workspaces/workspaces_reorder.yaml                                                       @getsentry/kingfisher @getsentry/documentation
openapi/schemas/ActionObject.yaml                                                                         @getsentry/fang @getsentry/libretto @getsentry/documentation
openapi/schemas/ActionsObject.yaml                                                                        @getsentry/fang @getsentry/libretto @getsentry/documentation
openapi/schemas/AttachmentBaseObject.yaml                                                                 @getsentry/squonk @getsentry/documentation
openapi/schemas/AttachmentObject.yaml                                                                     @getsentry/squonk @getsentry/documentation
openapi/schemas/AttachmentResponse.yaml                                                                   @getsentry/squonk @getsentry/documentation
openapi/schemas/AttachmentThumbnails.yaml                                                                 @getsentry/squonk @getsentry/documentation
openapi/schemas/AttachmentUpdateInput.yaml                                                                @getsentry/spyglass @getsentry/documentation
openapi/schemas/AttachmentUpdateRequest.yaml                                                              @getsentry/spyglass @getsentry/documentation
openapi/schemas/AttachmentUploadResponse.yaml                                                             @getsentry/squonk @getsentry/documentation
openapi/schemas/AuditLogObject.yaml                                                                       @getsentry/audit-log @getsentry/documentation
openapi/schemas/AuditLogResponse.yaml                                                                     @getsentry/audit-log @getsentry/documentation
openapi/schemas/AuditLogsResponse.yaml                                                                    @getsentry/audit-log @getsentry/documentation
openapi/schemas/AutomationObject.yaml                                                                     @getsentry/libretto @getsentry/documentation
openapi/schemas/AutomationResponse.yaml                                                                   @getsentry/libretto @getsentry/documentation
openapi/schemas/AutomationsResponse.yaml                                                                  @getsentry/libretto @getsentry/documentation
openapi/schemas/BrandCreateRequest.yaml                                                                   @getsentry/boxoffice @getsentry/popcorn @getsentry/documentation
openapi/schemas/BrandObject.yaml                                                                          @getsentry/boxoffice @getsentry/popcorn @getsentry/documentation
openapi/schemas/BrandResponse.yaml                                                                        @getsentry/boxoffice @getsentry/popcorn @getsentry/documentation
openapi/schemas/BrandUpdateRequest.yaml                                                                   @getsentry/boxoffice @getsentry/popcorn @getsentry/documentation
openapi/schemas/BrandsResponse.yaml                                                                       @getsentry/boxoffice @getsentry/popcorn @getsentry/documentation
openapi/schemas/ComplianceDeletionStatusObject.yaml                                                       @getsentry/spyglass @getsentry/documentation
openapi/schemas/ComplianceDeletionStatusesResponse.yaml                                                   @getsentry/spyglass @getsentry/documentation
openapi/schemas/ConditionObject.yaml                                                                      @getsentry/fang @getsentry/libretto @getsentry/documentation
openapi/schemas/ConditionsObject.yaml                                                                     @getsentry/fang @getsentry/libretto @getsentry/documentation
openapi/schemas/CountResponse.yaml                                                                        @getsentry/bilby @getsentry/documentation
openapi/schemas/CreateResourceResult.yaml                                                                 @getsentry/bilby @getsentry/documentation
openapi/schemas/CustomFieldObject.yaml                                                                    @getsentry/vinyl @getsentry/documentation
openapi/schemas/CustomFieldOptionObject.yaml                                                              @getsentry/vinyl @getsentry/documentation
openapi/schemas/CustomFieldOptionResponse.yaml                                                            @getsentry/vinyl @getsentry/documentation
openapi/schemas/CustomFieldOptionsResponse.yaml                                                           @getsentry/vinyl @getsentry/documentation
openapi/schemas/CustomRoleConfigurationObject.yaml                                                        @getsentry/firefly @getsentry/documentation
openapi/schemas/CustomRoleObject.yaml                                                                     @getsentry/bilby @getsentry/documentation
openapi/schemas/CustomRoleResponse.yaml                                                                   @getsentry/bilby @getsentry/documentation
openapi/schemas/CustomRolesResponse.yaml                                                                  @getsentry/bilby @getsentry/documentation
openapi/schemas/DeletedUserObject.yaml                                                                    @getsentry/bilby @getsentry/documentation
openapi/schemas/DeletedUserResponse.yaml                                                                  @getsentry/bilby @getsentry/documentation
openapi/schemas/DeletedUsersResponse.yaml                                                                 @getsentry/bilby @getsentry/documentation
openapi/schemas/DynamicContentObject.yaml                                                                 @getsentry/athene @getsentry/documentation
openapi/schemas/DynamicContentResponse.yaml                                                               @getsentry/athene @getsentry/documentation
openapi/schemas/DynamicContentVariantObject.yaml                                                          @getsentry/athene @getsentry/documentation
openapi/schemas/DynamicContentVariantResponse.yaml                                                        @getsentry/athene @getsentry/documentation
openapi/schemas/DynamicContentVariantsResponse.yaml                                                       @getsentry/athene @getsentry/documentation
openapi/schemas/DynamicContentsResponse.yaml                                                              @getsentry/athene @getsentry/documentation
openapi/schemas/EndUserObject.yaml                                                                        @getsentry/bilby @getsentry/documentation
openapi/schemas/EndUserResponse.yaml                                                                      @getsentry/bilby @getsentry/documentation
openapi/schemas/GroupMembershipObject.yaml                                                                @getsentry/bolt @getsentry/documentation
openapi/schemas/GroupMembershipResponse.yaml                                                              @getsentry/bolt @getsentry/documentation
openapi/schemas/GroupMembershipsResponse.yaml                                                             @getsentry/bolt @getsentry/documentation
openapi/schemas/GroupObject.yaml                                                                          @getsentry/bolt @getsentry/documentation
openapi/schemas/GroupResponse.yaml                                                                        @getsentry/bolt @getsentry/documentation
openapi/schemas/GroupsCountObject.yaml                                                                    @getsentry/bolt @getsentry/documentation
openapi/schemas/GroupsResponse.yaml                                                                       @getsentry/bolt @getsentry/documentation
openapi/schemas/HostMappingObject.yaml                                                                    @getsentry/boxoffice @getsentry/popcorn @getsentry/documentation
openapi/schemas/IncrementalSkillBasedRouting.yaml                                                         @getsentry/argonauts @getsentry/documentation
openapi/schemas/IncrementalSkillBasedRoutingAttribute.yaml                                                @getsentry/argonauts @getsentry/documentation
openapi/schemas/IncrementalSkillBasedRoutingAttributeValue.yaml                                           @getsentry/argonauts @getsentry/documentation
openapi/schemas/IncrementalSkillBasedRoutingInstanceValue.yaml                                            @getsentry/argonauts @getsentry/documentation
openapi/schemas/JobStatusObject.yaml                                                                      @getsentry/bolt @getsentry/documentation
openapi/schemas/JobStatusResponse.yaml                                                                    @getsentry/bolt @getsentry/documentation
openapi/schemas/JobStatusResultObject.yaml                                                                @getsentry/bolt @getsentry/documentation
openapi/schemas/JobStatusesResponse.yaml                                                                  @getsentry/bolt @getsentry/documentation
openapi/schemas/MacroApplyTicketResponse.yaml                                                             @getsentry/fang @getsentry/documentation
openapi/schemas/MacroAttachmentObject.yaml                                                                @getsentry/fang @getsentry/documentation
openapi/schemas/MacroAttachmentResponse.yaml                                                              @getsentry/fang @getsentry/documentation
openapi/schemas/MacroAttachmentsResponse.yaml                                                             @getsentry/fang @getsentry/documentation
openapi/schemas/MacroCategoriesResponse.yaml                                                              @getsentry/fang @getsentry/documentation
openapi/schemas/MacroCommonObject.yaml                                                                    @getsentry/fang @getsentry/documentation
openapi/schemas/MacroInput.yaml                                                                           @getsentry/fang @getsentry/documentation
openapi/schemas/MacroObject.yaml                                                                          @getsentry/fang @getsentry/documentation
openapi/schemas/MacroResponse.yaml                                                                        @getsentry/fang @getsentry/documentation
openapi/schemas/MacroUpdateManyInput.yaml                                                                 @getsentry/fang @getsentry/documentation
openapi/schemas/MacrosResponse.yaml                                                                       @getsentry/fang @getsentry/documentation
openapi/schemas/OLAPoliciesResponse.yaml                                                                  @getsentry/fang @getsentry/documentation
openapi/schemas/OLAPolicyFilterConditionObject.yaml                                                       @getsentry/fang @getsentry/documentation
openapi/schemas/OLAPolicyFilterDefinitionResponse.yaml                                                    @getsentry/fang @getsentry/documentation
openapi/schemas/OLAPolicyFilterObject.yaml                                                                @getsentry/fang @getsentry/documentation
openapi/schemas/OLAPolicyMetricObject.yaml                                                                @getsentry/fang @getsentry/documentation
openapi/schemas/OLAPolicyObject.yaml                                                                      @getsentry/fang @getsentry/documentation
openapi/schemas/OLAPolicyResponse.yaml                                                                    @getsentry/fang @getsentry/documentation
openapi/schemas/OffsetPaginationObject.yaml                                                               @getsentry/orchid @getsentry/bilby @getsentry/fang
openapi/schemas/OrganizationFieldObject.yaml                                                              @getsentry/kowari @getsentry/vinyl @getsentry/documentation
openapi/schemas/OrganizationFieldResponse.yaml                                                            @getsentry/kowari @getsentry/vinyl @getsentry/documentation
openapi/schemas/OrganizationFieldsResponse.yaml                                                           @getsentry/kowari @getsentry/vinyl @getsentry/documentation
openapi/schemas/OrganizationMembershipObject.yaml                                                         @getsentry/kowari @getsentry/documentation
openapi/schemas/OrganizationMembershipResponse.yaml                                                       @getsentry/kowari @getsentry/documentation
openapi/schemas/OrganizationMembershipsResponse.yaml                                                      @getsentry/kowari @getsentry/documentation
openapi/schemas/OrganizationSubscriptionCreateRequest.yaml                                                @getsentry/kowari @getsentry/documentation
openapi/schemas/OrganizationSubscriptionInput.yaml                                                        @getsentry/kowari @getsentry/documentation
openapi/schemas/OrganizationSubscriptionObject.yaml                                                       @getsentry/kowari @getsentry/documentation
openapi/schemas/OrganizationSubscriptionResponse.yaml                                                     @getsentry/kowari @getsentry/documentation
openapi/schemas/OrganizationSubscriptionsResponse.yaml                                                    @getsentry/kowari @getsentry/documentation
openapi/schemas/PushNotificationDevicesInput.yaml                                                         @getsentry/lir @getsentry/documentation
openapi/schemas/PushNotificationDevicesRequest.yaml                                                       @getsentry/lir @getsentry/documentation
openapi/schemas/RequestObject.yaml                                                                        @getsentry/boxoffice @getsentry/popcorn @getsentry/documentation
openapi/schemas/RequestResponse.yaml                                                                      @getsentry/boxoffice @getsentry/popcorn @getsentry/documentation
openapi/schemas/RequestsResponse.yaml                                                                     @getsentry/boxoffice @getsentry/popcorn @getsentry/documentation
openapi/schemas/ResourceCollectionObject.yaml                                                             @getsentry/dingo @getsentry/documentation
openapi/schemas/ResourceCollectionResponse.yaml                                                           @getsentry/dingo @getsentry/documentation
openapi/schemas/ResourceCollectionsResponse.yaml                                                          @getsentry/dingo @getsentry/documentation
openapi/schemas/SLAPoliciesResponse.yaml                                                                  @getsentry/fang @getsentry/documentation
openapi/schemas/SLAPolicyFilterConditionObject.yaml                                                       @getsentry/fang @getsentry/documentation
openapi/schemas/SLAPolicyFilterDefinitionResponse.yaml                                                    @getsentry/fang @getsentry/documentation
openapi/schemas/SLAPolicyFilterObject.yaml                                                                @getsentry/fang @getsentry/documentation
openapi/schemas/SLAPolicyMetricObject.yaml                                                                @getsentry/fang @getsentry/documentation
openapi/schemas/SLAPolicyObject.yaml                                                                      @getsentry/fang @getsentry/documentation
openapi/schemas/SLAPolicyResponse.yaml                                                                    @getsentry/fang @getsentry/documentation
openapi/schemas/SatisfactionRatingsCountResponse.yaml                                                     @getsentry/fang @getsentry/documentation
openapi/schemas/SharingAgreementObject.yaml                                                               @getsentry/boxoffice @getsentry/popcorn @getsentry/documentation
openapi/schemas/SharingAgreementResponse.yaml                                                             @getsentry/boxoffice @getsentry/popcorn @getsentry/documentation
openapi/schemas/SharingAgreementsResponse.yaml                                                            @getsentry/boxoffice @getsentry/popcorn @getsentry/documentation
openapi/schemas/SkillBasedRoutingAttributeDefinitions.yaml                                                @getsentry/fang @getsentry/documentation
openapi/schemas/SkillBasedRoutingAttributeObject.yaml                                                     @getsentry/fang @getsentry/documentation
openapi/schemas/SkillBasedRoutingAttributeResponse.yaml                                                   @getsentry/fang @getsentry/documentation
openapi/schemas/SkillBasedRoutingAttributeValueObject.yaml                                                @getsentry/fang @getsentry/documentation
openapi/schemas/SkillBasedRoutingAttributeValueResponse.yaml                                              @getsentry/fang @getsentry/documentation
openapi/schemas/SkillBasedRoutingAttributeValuesResponse.yaml                                             @getsentry/fang @getsentry/documentation
openapi/schemas/SkillBasedRoutingAttributesResponse.yaml                                                  @getsentry/fang @getsentry/documentation
openapi/schemas/SkillBasedRoutingTicketFulfilledResponse.yaml                                             @getsentry/fang @getsentry/documentation
openapi/schemas/SupportAddressObject.yaml                                                                 @getsentry/strongbad @getsentry/documentation
openapi/schemas/SupportAddressResponse.yaml                                                               @getsentry/strongbad @getsentry/documentation
openapi/schemas/SupportAddressesResponse.yaml                                                             @getsentry/strongbad @getsentry/documentation
openapi/schemas/SystemFieldOptionObject.yaml                                                              @getsentry/boxoffice @getsentry/popcorn @getsentry/documentation
openapi/schemas/TargetBasecamp.yaml                                                                       @getsentry/platycorn @getsentry/documentation
openapi/schemas/TargetCampfire.yaml                                                                       @getsentry/platycorn @getsentry/documentation
openapi/schemas/TargetClickatell.yaml                                                                     @getsentry/platycorn @getsentry/documentation
openapi/schemas/TargetCommonFields.yaml                                                                   @getsentry/vegemite @getsentry/documentation
openapi/schemas/TargetEmail.yaml                                                                          @getsentry/vegemite @getsentry/documentation
openapi/schemas/TargetFailureObject.yaml                                                                  @getsentry/vegemite @getsentry/documentation
openapi/schemas/TargetFailureResponse.yaml                                                                @getsentry/vegemite @getsentry/documentation
openapi/schemas/TargetFailuresResponse.yaml                                                               @getsentry/vegemite @getsentry/documentation
openapi/schemas/TargetFlowdock.yaml                                                                       @getsentry/platycorn @getsentry/documentation
openapi/schemas/TargetGetSatisfaction.yaml                                                                @getsentry/platycorn @getsentry/documentation
openapi/schemas/TargetHTTP.yaml                                                                           @getsentry/vegemite @getsentry/documentation
openapi/schemas/TargetJira.yaml                                                                           @getsentry/platycorn @getsentry/documentation
openapi/schemas/TargetObject.yaml                                                                         @getsentry/vegemite @getsentry/documentation
openapi/schemas/TargetPivotal.yaml                                                                        @getsentry/platycorn @getsentry/documentation
openapi/schemas/TargetResponse.yaml                                                                       @getsentry/vegemite @getsentry/documentation
openapi/schemas/TargetTwitter.yaml                                                                        @getsentry/platycorn @getsentry/documentation
openapi/schemas/TargetURL.yaml                                                                            @getsentry/vegemite @getsentry/documentation
openapi/schemas/TargetYammer.yaml                                                                         @getsentry/platycorn @getsentry/documentation
openapi/schemas/TargetsResponse.yaml                                                                      @getsentry/vegemite @getsentry/documentation
openapi/schemas/TicketAuditObject.yaml                                                                    @getsentry/ticket-platform @getsentry/documentation
openapi/schemas/TicketAuditResponse.yaml                                                                  @getsentry/ticket-platform @getsentry/documentation
openapi/schemas/TicketAuditViaObject.yaml                                                                 @getsentry/ticket-platform @getsentry/documentation
openapi/schemas/TicketAuditsCountResponse.yaml                                                            @getsentry/ticket-platform @getsentry/documentation
openapi/schemas/TicketAuditsResponse.yaml                                                                 @getsentry/ticket-platform @getsentry/documentation
openapi/schemas/TicketAuditsResponseNoneCursor.yaml                                                       @getsentry/ticket-platform @getsentry/documentation
openapi/schemas/TicketBulkImportRequest.yaml                                                              @getsentry/boxoffice @getsentry/popcorn @getsentry/documentation
openapi/schemas/TicketChatCommentRedactionResponse.yaml                                                   @getsentry/orchid @getsentry/documentation
openapi/schemas/TicketCommentResponse.yaml                                                                @getsentry/boxoffice @getsentry/popcorn @getsentry/documentation
openapi/schemas/TicketCommentsResponse.yaml                                                               @getsentry/boxoffice @getsentry/popcorn @getsentry/documentation
openapi/schemas/TicketFieldCountResponse.yaml                                                             @getsentry/boxoffice @getsentry/popcorn @getsentry/documentation
openapi/schemas/TicketFieldObject.yaml                                                                    @getsentry/boxoffice @getsentry/popcorn @getsentry/documentation
openapi/schemas/TicketFieldResponse.yaml                                                                  @getsentry/boxoffice @getsentry/popcorn @getsentry/documentation
openapi/schemas/TicketFieldsResponse.yaml                                                                 @getsentry/boxoffice @getsentry/popcorn @getsentry/documentation
openapi/schemas/TicketFormObject.yaml                                                                     @getsentry/boxoffice @getsentry/popcorn @getsentry/documentation
openapi/schemas/TicketFormResponse.yaml                                                                   @getsentry/boxoffice @getsentry/popcorn @getsentry/documentation
openapi/schemas/TicketFormsResponse.yaml                                                                  @getsentry/boxoffice @getsentry/popcorn @getsentry/documentation
openapi/schemas/TicketImportInput.yaml                                                                    @getsentry/boxoffice @getsentry/popcorn @getsentry/documentation
openapi/schemas/TicketImportRequest.yaml                                                                  @getsentry/boxoffice @getsentry/popcorn @getsentry/documentation
openapi/schemas/TicketMetricEventBaseObject.yaml                                                          @getsentry/fang @getsentry/documentation
openapi/schemas/TicketMetricEventBreachObject.yaml                                                        @getsentry/fang @getsentry/documentation
openapi/schemas/TicketMetricEventOLAObject.yaml                                                           @getsentry/fang @getsentry/documentation
openapi/schemas/TicketMetricEventSLAObject.yaml                                                           @getsentry/fang @getsentry/documentation
openapi/schemas/TicketMetricEventUpdateStatusObject.yaml                                                  @getsentry/fang @getsentry/documentation
openapi/schemas/TicketMetricEventsResponse.yaml                                                           @getsentry/fang @getsentry/documentation
openapi/schemas/UpdateResourceResult.yaml                                                                 @getsentry/bolt @getsentry/documentation
openapi/schemas/UserCreateInput.yaml                                                                      @getsentry/bilby @getsentry/documentation
openapi/schemas/UserFieldObject.yaml                                                                      @getsentry/bilby @getsentry/vinyl @getsentry/documentation
openapi/schemas/UserFieldResponse.yaml                                                                    @getsentry/bilby @getsentry/vinyl @getsentry/documentation
openapi/schemas/UserFieldsResponse.yaml                                                                   @getsentry/bilby @getsentry/vinyl @getsentry/documentation
openapi/schemas/UserForAdmin.yaml                                                                         @getsentry/bilby @getsentry/documentation
openapi/schemas/UserForEndUser.yaml                                                                       @getsentry/bilby @getsentry/documentation
openapi/schemas/UserIdentitiesResponse.yaml                                                               @getsentry/bilby @getsentry/documentation
openapi/schemas/UserIdentityObject.yaml                                                                   @getsentry/bilby @getsentry/documentation
openapi/schemas/UserIdentityResponse.yaml                                                                 @getsentry/bilby @getsentry/documentation
openapi/schemas/UserInput.yaml                                                                            @getsentry/bilby @getsentry/documentation
openapi/schemas/UserMergeByIdInput.yaml                                                                   @getsentry/bilby @getsentry/documentation
openapi/schemas/UserMergePropertiesInput.yaml                                                             @getsentry/bilby @getsentry/documentation
openapi/schemas/UserObject.yaml                                                                           @getsentry/bilby @getsentry/documentation
openapi/schemas/UserPasswordRequirementsResponse.yaml                                                     @getsentry/bilby @getsentry/documentation
openapi/schemas/UserRelatedObject.yaml                                                                    @getsentry/bilby @getsentry/documentation
openapi/schemas/UserRelatedResponse.yaml                                                                  @getsentry/bilby @getsentry/documentation
openapi/schemas/UserRequest.yaml                                                                          @getsentry/bilby @getsentry/documentation
openapi/schemas/UserResponse.yaml                                                                         @getsentry/bilby @getsentry/documentation
openapi/schemas/UsersRequest.yaml                                                                         @getsentry/bilby @getsentry/documentation
openapi/schemas/UsersResponse.yaml                                                                        @getsentry/bilby @getsentry/documentation
openapi/schemas/ViaObject.yaml                                                                            @getsentry/fang @getsentry/libretto @getsentry/documentation
openapi/schemas/ViewCountObject.yaml                                                                      @getsentry/views-core @getsentry/views-enablement @getsentry/documentation
openapi/schemas/ViewCountResponse.yaml                                                                    @getsentry/views-core @getsentry/views-enablement @getsentry/documentation
openapi/schemas/ViewCountsResponse.yaml                                                                   @getsentry/views-core @getsentry/views-enablement @getsentry/documentation
openapi/schemas/ViewExportResponse.yaml                                                                   @getsentry/views-core @getsentry/views-enablement @getsentry/documentation
openapi/schemas/ViewObject.yaml                                                                           @getsentry/views-core @getsentry/views-enablement @getsentry/documentation
openapi/schemas/ViewResponse.yaml                                                                         @getsentry/views-core @getsentry/views-enablement @getsentry/documentation
openapi/schemas/ViewsResponse.yaml                                                                        @getsentry/views-core @getsentry/views-enablement @getsentry/documentation
openapi/schemas/WorkspaceInput.yaml                                                                       @getsentry/kingfisher @getsentry/documentation
openapi/schemas/WorkspaceObject.yaml                                                                      @getsentry/kingfisher @getsentry/documentation
openapi/schemas/WorkspaceResponse.yaml                                                                    @getsentry/kingfisher @getsentry/documentation
openapi/schemas/account                                                                                   @getsentry/quoll @getsentry/documentation
openapi/schemas/accounts                                                                                  @getsentry/quoll @getsentry/documentation
openapi/schemas/activities                                                                                @getsentry/harrier @getsentry/documentation
openapi/schemas/assignables                                                                               @getsentry/iris
openapi/schemas/bookmarks/BookmarkCreateRequest.yaml                                                      @getsentry/documentation
openapi/schemas/bookmarks/BookmarkInput.yaml                                                              @getsentry/documentation
openapi/schemas/bookmarks/BookmarkObject.yaml                                                             @getsentry/documentation
openapi/schemas/bookmarks/BookmarkResponse.yaml                                                           @getsentry/documentation
openapi/schemas/bookmarks/BookmarksResponse.yaml                                                          @getsentry/documentation
openapi/schemas/custom_statuses                                                                           @getsentry/boxoffice @getsentry/popcorn @getsentry/documentation
openapi/schemas/incremental_exports                                                                       @getsentry/ticket-platform @getsentry/dugong @getsentry/bilby @getsentry/kowari @getsentry/documentation
openapi/schemas/organizations                                                                             @getsentry/kowari @getsentry/documentation
openapi/schemas/relationship_filter                                                                       @getsentry/vinyl @getsentry/documentation
openapi/schemas/satisfaction_ratings/SatisfactionRatingObject.yaml                                        @getsentry/fang @getsentry/documentation
openapi/schemas/satisfaction_ratings/SatisfactionRatingResponse.yaml                                      @getsentry/fang @getsentry/documentation
openapi/schemas/satisfaction_ratings/SatisfactionRatingsResponse.yaml                                     @getsentry/fang @getsentry/documentation
openapi/schemas/satisfaction_reasons/SatisfactionReasonObject.yaml                                        @getsentry/fang @getsentry/documentation
openapi/schemas/satisfaction_reasons/SatisfactionReasonResponse.yaml                                      @getsentry/fang @getsentry/documentation
openapi/schemas/satisfaction_reasons/SatisfactionReasonsResponse.yaml                                     @getsentry/fang @getsentry/documentation
openapi/schemas/search                                                                                    @getsentry/search @getsentry/documentation
openapi/schemas/sessions                                                                                  @getsentry/secdev @getsentry/documentation
openapi/schemas/suspended_tickets                                                                         @getsentry/strongbad @getsentry/documentation
openapi/schemas/tags                                                                                      @getsentry/boxoffice @getsentry/popcorn @getsentry/documentation
openapi/schemas/ticket_metrics/TicketMetricObject.yaml                                                    @getsentry/fang @getsentry/documentation
openapi/schemas/ticket_metrics/TicketMetricTimeObject.yaml                                                @getsentry/fang @getsentry/documentation
openapi/schemas/ticket_metrics/TicketMetricsByTicketMetricIdResponse.yaml                                 @getsentry/fang @getsentry/documentation
openapi/schemas/ticket_metrics/TicketMetricsResponse.yaml                                                 @getsentry/fang @getsentry/documentation
openapi/schemas/ticket_skips/TicketSkipCreation.yaml                                                      @getsentry/argonauts @getsentry/documentation
openapi/schemas/ticket_skips/TicketSkipObject.yaml                                                        @getsentry/argonauts @getsentry/documentation
openapi/schemas/ticket_skips/TicketSkipsResponse.yaml                                                     @getsentry/argonauts @getsentry/documentation
openapi/schemas/tickets/AuditObject.yaml                                                                  @getsentry/boxoffice @getsentry/popcorn @getsentry/documentation
openapi/schemas/tickets/CollaboratorObject.yaml                                                           @getsentry/strongbad @getsentry/documentation
openapi/schemas/tickets/EmailCCObject.yaml                                                                @getsentry/strongbad @getsentry/documentation
openapi/schemas/tickets/FollowerObject.yaml                                                               @getsentry/strongbad @getsentry/documentation
openapi/schemas/tickets/ListDeletedTicketsResponse.yaml                                                   @getsentry/boxoffice @getsentry/popcorn @getsentry/documentation
openapi/schemas/tickets/ListTicketCollaboratorsResponse.yaml                                              @getsentry/strongbad @getsentry/documentation
openapi/schemas/tickets/ListTicketEmailCCsResponse.yaml                                                   @getsentry/strongbad @getsentry/documentation
openapi/schemas/tickets/ListTicketFollowersResponse.yaml                                                  @getsentry/strongbad @getsentry/documentation
openapi/schemas/tickets/ListTicketIncidentsResponse.yaml                                                  @getsentry/boxoffice @getsentry/popcorn @getsentry/documentation
openapi/schemas/tickets/ListTicketProblemsResponse.yaml                                                   @getsentry/boxoffice @getsentry/popcorn @getsentry/documentation
openapi/schemas/tickets/TicketCommentObject.yaml                                                          @getsentry/boxoffice @getsentry/popcorn @getsentry/documentation
openapi/schemas/tickets/TicketCommentsCountResponse.yaml                                                  @getsentry/boxoffice @getsentry/popcorn @getsentry/documentation
openapi/schemas/tickets/TicketCreateInput.yaml                                                            @getsentry/boxoffice @getsentry/popcorn @getsentry/documentation
openapi/schemas/tickets/TicketCreateRequest.yaml                                                          @getsentry/boxoffice @getsentry/popcorn @getsentry/documentation
openapi/schemas/tickets/TicketCreateVoicemailTicketInput.yaml                                             @getsentry/zenguins @getsentry/documentation
openapi/schemas/tickets/TicketCreateVoicemailTicketRequest.yaml                                           @getsentry/zenguins @getsentry/documentation
openapi/schemas/tickets/TicketCreateVoicemailTicketVoiceCommentInput.yaml                                 @getsentry/zenguins @getsentry/documentation
openapi/schemas/tickets/TicketMergeInput.yaml                                                             @getsentry/boxoffice @getsentry/popcorn @getsentry/documentation
openapi/schemas/tickets/TicketObject.yaml                                                                 @getsentry/boxoffice @getsentry/popcorn @getsentry/documentation
openapi/schemas/tickets/TicketRelatedInformation.yaml                                                     @getsentry/boxoffice @getsentry/popcorn @getsentry/documentation
openapi/schemas/tickets/TicketResponse.yaml                                                               @getsentry/boxoffice @getsentry/popcorn @getsentry/documentation
openapi/schemas/tickets/TicketUpdateInput.yaml                                                            @getsentry/boxoffice @getsentry/popcorn @getsentry/documentation
openapi/schemas/tickets/TicketUpdateRequest.yaml                                                          @getsentry/boxoffice @getsentry/popcorn @getsentry/documentation
openapi/schemas/tickets/TicketUpdateResponse.yaml                                                         @getsentry/boxoffice @getsentry/popcorn @getsentry/documentation
openapi/schemas/tickets/TicketsCreateRequest.yaml                                                         @getsentry/boxoffice @getsentry/popcorn @getsentry/documentation
openapi/schemas/tickets/TicketsResponse.yaml                                                              @getsentry/boxoffice @getsentry/popcorn @getsentry/documentation
openapi/schemas/trigger_categories                                                                        @getsentry/libretto @getsentry/documentation
openapi/schemas/triggers                                                                                  @getsentry/libretto @getsentry/documentation
openapi/schemas/views/ViewsCountResponse.yaml                                                             @getsentry/boxoffice @getsentry/popcorn @getsentry/documentation
policy.xml                                                                                                @getsentry/bolt
public/external/1000_cloudflare.html                                                                      @getsentry/edge-infra
public/external/429_cloudflare.html                                                                       @getsentry/edge-infra
public/external/500_cloudflare.html                                                                       @getsentry/edge-infra
public/external/always_online_cloudflare.html                                                             @getsentry/edge-infra
public/external/challenge_cloudflare.html                                                                 @getsentry/edge-infra
public/external/challenge_cloudflare_v2.html                                                              @getsentry/edge-infra
public/external/error_pages.css                                                                           @getsentry/harrier
public/external/ip_country_cloudflare.html                                                                @getsentry/edge-infra
public/external/salesforce/                                                                               @getsentry/platycorn
public/external/under_attack_cloudflare.html                                                              @getsentry/edge-infra
public/external/waf_cloudflare.html                                                                       @getsentry/edge-infra
public/fonts/                                                                                             @getsentry/bolt
public/images/                                                                                            @getsentry/bolt
public/images/16-filter-stroke.svg                                                                        @getsentry/fang
public/images/brands/social_buttons/                                                                      @getsentry/strongbad
public/images/call_console/                                                                               @getsentry/voice
public/images/connect/                                                                                    @getsentry/bolt
public/images/emojis/                                                                                     @getsentry/hibiscus
public/images/events/ticket_sharing.png                                                                   @getsentry/boxoffice @getsentry/popcorn
public/images/flags/                                                                                      @getsentry/hibiscus
public/images/icons/alert-warning-stroke.png                                                              @getsentry/strongbad
public/images/icons/auth_facebook.svg                                                                     @getsentry/secdev
public/images/icons/auth_google.svg                                                                       @getsentry/secdev
public/images/icons/auth_microsoft.svg                                                                    @getsentry/secdev
public/images/icons/auth_twitter.svg                                                                      @getsentry/secdev
public/images/icons/auth_zendesk.svg                                                                      @getsentry/secdev
public/images/icons/file-document-stroke.png                                                              @getsentry/strongbad
public/images/icons/file-generic-stroke.png                                                               @getsentry/strongbad
public/images/icons/file-image-stroke.png                                                                 @getsentry/strongbad
public/images/icons/file-pdf-stroke.png                                                                   @getsentry/strongbad
public/images/icons/file-presentation-stroke.png                                                          @getsentry/strongbad
public/images/icons/file-spreadsheet-stroke.png                                                           @getsentry/strongbad
public/images/icons/file-zip-stroke.png                                                                   @getsentry/strongbad
public/images/icons/link.svg                                                                              @getsentry/firefly
public/images/icons/ptg-lock.svg                                                                          @getsentry/firefly
public/images/icons/sharing.png                                                                           @getsentry/boxoffice @getsentry/popcorn
public/images/icons/ticket_sharing_generic.svg                                                            @getsentry/boxoffice @getsentry/popcorn
public/images/icons/ticket_sharing_zendesk.svg                                                            @getsentry/boxoffice @getsentry/popcorn
public/images/info.svg                                                                                    @getsentry/orchid
public/images/speak/                                                                                      @getsentry/boxoffice @getsentry/popcorn
public/images/types/fake_customer.png                                                                     @getsentry/ponderosa
public/images/voice/                                                                                      @getsentry/voice
resque.ru                                                                                                 @getsentry/squonk
script/archiver                                                                                           @getsentry/support-ticket-archiving
script/backfill_coverage.rb                                                                               @getsentry/bolt
script/check_codeowners_globs.sh                                                                          @getsentry/bolt
script/ci-create_test_rebalance_pr.rb                                                                     @getsentry/bolt
script/ci-failures                                                                                        @getsentry/teapot @getsentry/tealeaves
script/cleanliness.sh                                                                                     @getsentry/bolt
script/concurable-backfill-scheduler                                                                      @getsentry/ticket-platform
script/create_suspended_ticket.rb                                                                         @getsentry/strongbad
script/data_deletion_runner                                                                               @getsentry/account-data-deletion
script/deploy_static_assets                                                                               @getsentry/squonk
script/download_translations                                                                              @getsentry/squonk @getsentry/i18n
script/kubernetes_mtc_liveness                                                                            @getsentry/strongbad
script/kubernetes_mtc_startup                                                                             @getsentry/strongbad
script/kubernetes_resque_liveness                                                                         @getsentry/squonk
script/kubernetes_resque_prestop                                                                          @getsentry/squonk
script/mail_ticket_creator*                                                                               @getsentry/strongbad
script/method_search.rb                                                                                   @getsentry/bolt
script/non-reset-prs                                                                                      @getsentry/squonk
script/normalize_gemfile                                                                                  @getsentry/rails-upgrade
script/patch                                                                                              @getsentry/squonk
script/process_email                                                                                      @getsentry/strongbad
script/publish-assets                                                                                     @getsentry/squonk
script/remove_controller.sh                                                                               @getsentry/bolt
script/rule_precache                                                                                      @getsentry/fang @getsentry/libretto
script/s3_assets_sync.sh                                                                                  @getsentry/squonk
script/sync_attachment_stores                                                                             @getsentry/squonk
script/trigger-samson-stage                                                                               @getsentry/squonk
script/version                                                                                            @getsentry/squonk
service.yml                                                                                               @getsentry/squonk
sonar-project.properties                                                                                  @getsentry/bolt @getsentry/bilby
spinnaker/                                                                                                @getsentry/squonk
test/backfills/activate_voice_partner_edition_account_test.rb                                             @getsentry/zenguins
test/backfills/add_facebook_page_scoped_id_test.rb                                                        @getsentry/ocean
test/backfills/aw_self_serve_migration_control_setting_change_test.rb                                     @getsentry/iris
test/backfills/backfill_account_groups_limit_test.rb                                                      @getsentry/bolt
test/backfills/backfill_account_products_test.rb                                                          @getsentry/bilby
test/backfills/backfill_blanked_settings_test.rb                                                          @getsentry/bilby
test/backfills/backfill_cleanup_group_memberships_for_accounts_test.rb                                    @getsentry/bolt @getsentry/bilby
test/backfills/backfill_correct_mobile_sdk_apps_test.rb                                                   @getsentry/lir
test/backfills/backfill_delete_policies_with_deleted_permission_sets_test.rb                              @getsentry/space-dogs
test/backfills/backfill_delete_user_seats_for_deleted_users_test.rb                                       @getsentry/voice
test/backfills/backfill_inbound_mail_rate_limits_test.rb                                                  @getsentry/strongbad
test/backfills/backfill_lets_encrypt_cert_chain_test.rb                                                   @getsentry/secdev
test/backfills/backfill_macro_suggestions_test.csv                                                        @getsentry/fang
test/backfills/backfill_macro_suggestions_test.rb                                                         @getsentry/fang
test/backfills/backfill_nil_ticket_organization_test.rb                                                   @getsentry/boxoffice @getsentry/popcorn @getsentry/bilby
test/backfills/backfill_permission_set_policies_test.rb                                                   @getsentry/space-dogs
test/backfills/backfill_remove_voice_insight_fields_test.rb                                               @getsentry/kelpie
test/backfills/backfill_remove_voice_seats_off_inactive_users_test.rb                                     @getsentry/red-pandas
test/backfills/backfill_sandbox_type_test.rb                                                              @getsentry/ngiyari @getsentry/pcc-operations
test/backfills/backfill_status_test.rb                                                                    @getsentry/piratos
test/backfills/backfill_ticket_tags_test.rb                                                               @getsentry/piratos
test/backfills/backfill_update_cfc_ris_manifest_test.rb                                                   @getsentry/ocean
test/backfills/backfill_user_memberships_limit_test.rb                                                    @getsentry/bolt
test/backfills/backfill_views_serve_count_from_es_test.rb                                                 @getsentry/ingest
test/backfills/backfill_views_ticket_stream_test.rb                                                       @getsentry/ingest
test/backfills/backfill_zis_oauth_client_name_test.rb                                                     @getsentry/platypus
test/backfills/backfill_zopim_subscription_purchased_at_test.rb                                           @getsentry/narwhals @getsentry/otters
test/backfills/delete_account_attachments_test.rb                                                         @getsentry/squonk
test/backfills/delete_data_deletion_job_failed_audits_test.rb                                             @getsentry/account-data-deletion
test/backfills/delete_duplicated_system_permission_sets_test.rb                                           @getsentry/space-dogs
test/backfills/delete_user_sdk_identities_test.rb                                                         @getsentry/lir @getsentry/bilby
test/backfills/duplicate_organizations_test.rb                                                            @getsentry/bilby
test/backfills/durable_backfill/tasks/backfill_account_attribute_ticket_map_cleanup_test.rb               @getsentry/fang
test/backfills/durable_backfill/tasks/backfill_account_trigger_categories_migration_test.rb               @getsentry/libretto
test/backfills/durable_backfill/tasks/backfill_active_tickets_custom_status_id_test.rb                    @getsentry/boxoffice @getsentry/popcorn
test/backfills/durable_backfill/tasks/backfill_admin_permission_set_test.rb                               @getsentry/space-dogs
test/backfills/durable_backfill/tasks/backfill_archived_tickets_custom_status_id_test.rb                  @getsentry/boxoffice @getsentry/popcorn
test/backfills/durable_backfill/tasks/backfill_assign_admin_permission_set_to_admins_v2_test.rb           @getsentry/space-dogs
test/backfills/durable_backfill/tasks/backfill_billing_admin_permission_set_test.rb                       @getsentry/space-dogs
test/backfills/durable_backfill/tasks/backfill_billing_audits_test.rb                                     @getsentry/audit-log
test/backfills/durable_backfill/tasks/backfill_channels_twitter_oauth2_refresh_token_v2_test.rb           @getsentry/ocean
test/backfills/durable_backfill/tasks/backfill_chat_ended_event_test.rb                                   @getsentry/orchid
test/backfills/durable_backfill/tasks/backfill_chat_only_agents_v2_test.rb                                @getsentry/bilby
test/backfills/durable_backfill/tasks/backfill_convert_failed_incoming_conversions_test.rb                @getsentry/ocean
test/backfills/durable_backfill/tasks/backfill_custom_field_options_limit_v2_test.rb                      @getsentry/boxoffice @getsentry/popcorn
test/backfills/durable_backfill/tasks/backfill_custom_role_explore_permission_test.rb                     @getsentry/bilby
test/backfills/durable_backfill/tasks/backfill_deactivate_unused_twitter_handles_v2_test.rb               @getsentry/ocean
test/backfills/durable_backfill/tasks/backfill_default_signup_email_text_test.rb                          @getsentry/secdev
test/backfills/durable_backfill/tasks/backfill_delete_archived_or_dangling_outbound_emails_test.rb        @getsentry/strongbad
test/backfills/durable_backfill/tasks/backfill_delete_duplicated_system_permission_sets_test.rb           @getsentry/space-dogs
test/backfills/durable_backfill/tasks/backfill_delete_duplicated_system_permission_sets_v2_test.rb        @getsentry/space-dogs
test/backfills/durable_backfill/tasks/backfill_delete_erroneous_light_agent_policies_test.rb              @getsentry/space-dogs
test/backfills/durable_backfill/tasks/backfill_delete_organization_membership_v4_test.rb                  @getsentry/kowari
test/backfills/durable_backfill/tasks/backfill_delete_orphaned_group_memberships_test.rb                  @getsentry/bolt
test/backfills/durable_backfill/tasks/backfill_delete_orphaned_personal_macros_test.rb                    @getsentry/fang
test/backfills/durable_backfill/tasks/backfill_delete_orphaned_personal_macros_v2_test.rb                 @getsentry/fang
test/backfills/durable_backfill/tasks/backfill_delete_policies_with_deleted_permission_sets_test.rb       @getsentry/space-dogs
test/backfills/durable_backfill/tasks/backfill_email_synchronize_remote_files_test.rb                     @getsentry/strongbad
test/backfills/durable_backfill/tasks/backfill_facebook_monitor_feed_metadata_test.rb                     @getsentry/ocean
test/backfills/durable_backfill/tasks/backfill_facebook_promotable_post_metadata_test.rb                  @getsentry/ocean
test/backfills/durable_backfill/tasks/backfill_failed_gpi_channelbacks_test.rb                            @getsentry/ocean
test/backfills/durable_backfill/tasks/backfill_failed_spf_verification_test.rb                            @getsentry/strongbad
test/backfills/durable_backfill/tasks/backfill_force_retry_failed_targets_to_webhooks_migration_test.rb   @getsentry/vegemite
test/backfills/durable_backfill/tasks/backfill_force_targets_to_webhooks_migration_test.rb                @getsentry/vegemite
test/backfills/durable_backfill/tasks/backfill_forced_target_migrations_rollback_test.rb                  @getsentry/vegemite
test/backfills/durable_backfill/tasks/backfill_gdpr_connect_app_cleanup_test.rb                           @getsentry/spyglass
test/backfills/durable_backfill/tasks/backfill_hard_delete_organization_domains_test.rb                   @getsentry/kowari
test/backfills/durable_backfill/tasks/backfill_insert_default_custom_statuses_test.rb                     @getsentry/boxoffice @getsentry/popcorn
test/backfills/durable_backfill/tasks/backfill_manage_automations_to_permissions_test.rb                  @getsentry/space-dogs
test/backfills/durable_backfill/tasks/backfill_manage_triggers_to_permissions_v2_test.rb                  @getsentry/space-dogs
test/backfills/durable_backfill/tasks/backfill_organization_activity_email_template_v3_test.rb            @getsentry/strongbad
test/backfills/durable_backfill/tasks/backfill_re_encrypt_targets_v1_test.rb                              @getsentry/vegemite
test/backfills/durable_backfill/tasks/backfill_reactivate_facebook_pages_test.rb                          @getsentry/ocean
test/backfills/durable_backfill/tasks/backfill_remote_authentication_name_user_type_test.rb               @getsentry/unagi
test/backfills/durable_backfill/tasks/backfill_resolve_ulaanbaatar_time_zone_spelling_test.rb             @getsentry/i18n
test/backfills/durable_backfill/tasks/backfill_sandbox_archive_after_days_test.rb                         @getsentry/ticket-platform
test/backfills/durable_backfill/tasks/backfill_skill_based_attribute_ticket_mapping_test.rb               @getsentry/bilby
test/backfills/durable_backfill/tasks/backfill_subscribe_monitored_twitter_handles_via_proxy_v5_test.rb   @getsentry/ocean
test/backfills/durable_backfill/tasks/backfill_targets_delete_plaintext_credentials_v2_test.rb            @getsentry/vegemite
test/backfills/durable_backfill/tasks/backfill_ticket_access_to_permissions_test.rb                       @getsentry/space-dogs
test/backfills/durable_backfill/tasks/backfill_ticket_deflection_enquiry_test.rb                          @getsentry/waratah
test/backfills/durable_backfill/tasks/backfill_ticket_deflection_updated_at_test.rb                       @getsentry/waratah
test/backfills/durable_backfill/tasks/backfill_ticket_metric_set_removal_for_scrubbed_tickets_test.rb     @getsentry/fang
test/backfills/durable_backfill/tasks/backfill_ticket_public_if_comment_public_test.rb                    @getsentry/boxoffice @getsentry/popcorn
test/backfills/durable_backfill/tasks/backfill_update_cfc_ris_manifest_v3_test.rb                         @getsentry/ocean
test/backfills/durable_backfill/tasks/backfill_update_default_hold_custom_statuses_test.rb                @getsentry/boxoffice @getsentry/popcorn
test/backfills/durable_backfill/tasks/backfill_update_tickets_with_nil_custom_status_id_event_test.rb     @getsentry/boxoffice @getsentry/popcorn
test/backfills/durable_backfill/tasks/backfill_update_type_id_in_instance_value_test.rb                   @getsentry/argonauts
test/backfills/durable_backfill/tasks/backfill_user_identity_to_user_test.rb                              @getsentry/audit-log
test/backfills/durable_backfill/work_checkpointer_test.rb                                                 @getsentry/boxoffice @getsentry/popcorn
test/backfills/dynamodb_backfill/                                                                         @getsentry/ticket-platform
test/backfills/endusers_organization_cleanup_test.rb                                                      @getsentry/bilby
test/backfills/excluded_ticket_ids.csv                                                                    @getsentry/squonk
test/backfills/facebook_psid_migrate_to_external_id_test.rb                                               @getsentry/ocean
test/backfills/fix_non_boostable_subscription_features_test.rb                                            @getsentry/narwhals @getsentry/otters
test/backfills/hc_brands_backfill_test.rb                                                                 @getsentry/piratos
test/backfills/modify_vulnerable_triggers_test.rb                                                         @getsentry/orca
test/backfills/organization_membership_destroy_test.rb                                                    @getsentry/bilby
test/backfills/reconfigure_spammy_z3n_account_settings_test.rb                                            @getsentry/orca
test/backfills/record_displacer_test.rb                                                                   @getsentry/dugong
test/backfills/remove_subscription_feature_test.rb                                                        @getsentry/narwhals @getsentry/otters
test/backfills/remove_talk_partner_edition_accounts_backfill_test.rb                                      @getsentry/zenguins
test/backfills/rename_custom_roles_test.rb                                                                @getsentry/space-dogs
test/backfills/rename_deleted_organizations_test.rb                                                       @getsentry/bilby
test/backfills/routing_tasks_data_update_test.rb                                                          @getsentry/silk-road @getsentry/tea-horse
test/backfills/set_trial_expiration_date_for_open_ended_tpe_trials_test.rb                                @getsentry/zenguins
test/backfills/skill_based_routing_backfill_test.rb                                                       @getsentry/argonauts
test/backfills/soft_delete_attributes_from_instance_values_test.rb                                        @getsentry/argonauts
test/backfills/soft_delete_duplicate_talk_partner_edition_accounts_test.rb                                @getsentry/zenguins
test/backfills/ticket_metric_event_breach_remover_test.rb                                                 @getsentry/fang
test/backfills/truncate_cs_tables_test.rb                                                                 @getsentry/collections
test/backfills/update_type_id_in_instance_value_test.rb                                                   @getsentry/argonauts
test/backfills/user_entity_topic_backfill_test.rb                                                         @getsentry/piratos @getsentry/bilby
test/backfills/user_org_delete_memberships_test.rb                                                        @getsentry/bilby
test/backfills/user_org_fix_memberships_test.rb                                                           @getsentry/bilby
test/backfills/voice_partner_edition_account_backfill_test.rb                                             @getsentry/zenguins
test/consumers/brand_account_move_consumer_test.rb                                                        @getsentry/piratos
test/consumers/malware_scan_events_consumer_test.rb                                                       @getsentry/spyglass
test/consumers/routing_assignments_consumer_log_formatter_test.rb                                         @getsentry/silk-road @getsentry/tea-horse
test/consumers/routing_assignments_consumer_test.rb                                                       @getsentry/silk-road @getsentry/tea-horse
test/consumers/ticket_intent_consumer_test.rb                                                             @getsentry/lynx
test/consumers/ticket_language_consumer_test.rb                                                           @getsentry/lynx
test/consumers/ticket_metric_events_consumer_log_formatter_test.rb                                        @getsentry/fang
test/consumers/ticket_metric_events_consumer_test.rb                                                      @getsentry/fang
test/consumers/ticket_prediction_consumer/confidence_test.rb                                              @getsentry/lynx
test/consumers/ticket_prediction_consumer/metrics_test.rb                                                 @getsentry/lynx
test/consumers/ticket_prediction_consumer/ticket_consumer_processor_test.rb                               @getsentry/lynx
test/consumers/user_account_move_consumer_test.rb                                                         @getsentry/piratos @getsentry/bilby
test/consumers/user_id_sync_consumer_test.rb                                                              @getsentry/piratos @getsentry/bilby
test/consumers/views_entity_stream_account_move_completion_consumer_test.rb                               @getsentry/ingest
test/consumers/views_entity_stream_account_move_participant_consumer_test.rb                              @getsentry/ingest
test/consumers/views_ticket_entities_republisher*                                                         @getsentry/ingest
test/controllers/access_controller_test.rb                                                                @getsentry/unagi @getsentry/lir
test/controllers/account/subscription_controller_test.rb                                                  @getsentry/narwhals @getsentry/otters
test/controllers/account_setup_controller_test.rb                                                         @getsentry/quoll
test/controllers/accounts_controller_test.rb                                                              @getsentry/quoll
test/controllers/activate_trial_controller_test.rb                                                        @getsentry/ponderosa @getsentry/ngiyari @getsentry/pcc-operations
test/controllers/admin_controller_test.rb                                                                 @getsentry/fang @getsentry/libretto
test/controllers/admin_password_reset_requests_controller_test.rb                                         @getsentry/secdev @getsentry/unagi
test/controllers/api/base_controller_test.rb                                                              @getsentry/bolt
test/controllers/api/lotus/activities_controller_test.rb                                                  @getsentry/harrier
test/controllers/api/lotus/agents_controller_test.rb                                                      @getsentry/harrier
test/controllers/api/lotus/assignables/                                                                   @getsentry/harrier
test/controllers/api/lotus/ccs_and_followers/                                                             @getsentry/strongbad
test/controllers/api/lotus/chat_migrations_controller_test.rb                                             @getsentry/teapot @getsentry/tealeaves
test/controllers/api/lotus/chat_settings_controller_test.rb                                               @getsentry/iris
test/controllers/api/lotus/conversations_controller_test.rb                                               @getsentry/orchid
test/controllers/api/lotus/groups_controller_test.rb                                                      @getsentry/harrier @getsentry/bolt
test/controllers/api/lotus/knowledge_events_controller_test.rb                                            @getsentry/orchid
test/controllers/api/lotus/macros_controller_test.rb                                                      @getsentry/fang
test/controllers/api/lotus/manifests_controller_test.rb                                                   @getsentry/harrier
test/controllers/api/lotus/simplified_email_threading/                                                    @getsentry/strongbad
test/controllers/api/lotus/tickets_controller_test.rb                                                     @getsentry/orchid
test/controllers/api/lotus/time_zones_controller_test.rb                                                  @getsentry/harrier
test/controllers/api/lotus/trigger_categories_migration_controller_test.rb                                @getsentry/libretto
test/controllers/api/mobile/                                                                              @getsentry/lir
test/controllers/api/mobile/account/groups_controller_test.rb                                             @getsentry/lir @getsentry/bolt
test/controllers/api/mobile/current_user_controller_test.rb                                               @getsentry/lir @getsentry/bilby
test/controllers/api/mobile/user_fields_controller_test.rb                                                @getsentry/lir @getsentry/bilby @getsentry/vinyl
test/controllers/api/mobile/user_tags_controller_test.rb                                                  @getsentry/lir @getsentry/bilby
test/controllers/api/private/mobile_sdk/                                                                  @getsentry/lir
test/controllers/api/services/salesforce/                                                                 @getsentry/platycorn
test/controllers/api/v1/base_controller_test.rb                                                           @getsentry/bolt
test/controllers/api/v1/stats_controller_test.rb                                                          @getsentry/foundation-analytics-stream
test/controllers/api/v2/account/                                                                          @getsentry/narwhals @getsentry/otters
test/controllers/api/v2/account/features_controller_test.rb                                               @getsentry/quoll
test/controllers/api/v2/account/sandboxes_controller_test.rb                                              @getsentry/ngiyari @getsentry/pcc-operations
test/controllers/api/v2/account/subscription_controller_test.rb                                           @getsentry/narwhals @getsentry/otters
test/controllers/api/v2/account/voice_subscription/                                                       @getsentry/voice
test/controllers/api/v2/account/voice_subscription/recharge_settings_controller_test.rb                   @getsentry/narwhals @getsentry/otters
test/controllers/api/v2/accounts_controller_test.rb                                                       @getsentry/quoll
test/controllers/api/v2/accounts_creation_controller_test.rb                                              @getsentry/quoll
test/controllers/api/v2/attachments_controller_test.rb                                                    @getsentry/squonk
test/controllers/api/v2/audit_logs_controller_test.rb                                                     @getsentry/audit-log
test/controllers/api/v2/audits_controller_test.rb                                                         @getsentry/ticket-platform
test/controllers/api/v2/auth_billing/                                                                     @getsentry/narwhals @getsentry/otters
test/controllers/api/v2/autocomplete_controller_test.rb                                                   @getsentry/boxoffice @getsentry/popcorn
test/controllers/api/v2/base_controller_test.rb                                                           @getsentry/bolt
test/controllers/api/v2/base_custom_field_options_controller_test.rb                                      @getsentry/boxoffice @getsentry/popcorn
test/controllers/api/v2/billing/                                                                          @getsentry/narwhals @getsentry/otters
test/controllers/api/v2/brands_controller_test.rb                                                         @getsentry/boxoffice @getsentry/popcorn
test/controllers/api/v2/channels/voice/                                                                   @getsentry/zenguins
test/controllers/api/v2/chat_file_redactions_controller_test.rb                                           @getsentry/orchid
test/controllers/api/v2/chat_redactions_controller_test.rb                                                @getsentry/orchid
test/controllers/api/v2/collaborators_controller_test.rb                                                  @getsentry/strongbad
test/controllers/api/v2/comment_redactions_controller_test.rb                                             @getsentry/orchid
test/controllers/api/v2/countries_controller_test.rb                                                      @getsentry/i18n
test/controllers/api/v2/crm_data_controller_test.rb                                                       @getsentry/platycorn
test/controllers/api/v2/current_account_controller_test.rb                                                @getsentry/quoll
test/controllers/api/v2/current_user_controller_test.rb                                                   @getsentry/bilby
test/controllers/api/v2/custom_fields_controller_test.rb                                                  @getsentry/boxoffice @getsentry/popcorn @getsentry/vinyl
test/controllers/api/v2/custom_roles_controller_test.rb                                                   @getsentry/firefly
test/controllers/api/v2/custom_status/defaults_controller_test.rb                                         @getsentry/boxoffice @getsentry/popcorn
test/controllers/api/v2/custom_statuses_controller_test.rb                                                @getsentry/boxoffice @getsentry/popcorn
test/controllers/api/v2/deleted_tickets_controller_test.rb                                                @getsentry/boxoffice @getsentry/popcorn
test/controllers/api/v2/deleted_users_controller_test.rb                                                  @getsentry/bilby @getsentry/spyglass @getsentry/bolt
test/controllers/api/v2/dynamic_content/items_controller_test.rb                                          @getsentry/athene
test/controllers/api/v2/dynamic_content/variants_controller_test.rb                                       @getsentry/athene
test/controllers/api/v2/email_ccs_controller_test.rb                                                      @getsentry/strongbad
test/controllers/api/v2/embeddable/config_sets_controller_test.rb                                         @getsentry/copperhead
test/controllers/api/v2/end_user_identities_controller_test.rb                                            @getsentry/bilby
test/controllers/api/v2/end_users_controller_test.rb                                                      @getsentry/bilby
test/controllers/api/v2/errors_controller_test.rb                                                         @getsentry/bolt
test/controllers/api/v2/exports/gooddata_controller_test.rb                                               @getsentry/waratah
test/controllers/api/v2/exports/tickets_controller_test.rb                                                @getsentry/dugong
test/controllers/api/v2/external_email_credentials_controller_test.rb                                     @getsentry/strongbad
test/controllers/api/v2/feature_usage_metrics_controller_test.rb                                          @getsentry/fang @getsentry/libretto
test/controllers/api/v2/followers_controller_test.rb                                                      @getsentry/strongbad
test/controllers/api/v2/forwarding_verification_tokens_controller_test.rb                                 @getsentry/secdev
test/controllers/api/v2/gooddata_integration_controller_test.rb                                           @getsentry/waratah
test/controllers/api/v2/gooddata_users_controller_test.rb                                                 @getsentry/waratah
test/controllers/api/v2/group_memberships_controller_test.rb                                              @getsentry/bolt
test/controllers/api/v2/groups_controller_test.rb                                                         @getsentry/bolt @getsentry/teapot @getsentry/tealeaves
test/controllers/api/v2/help_center/organization_subscriptions_controller_test.rb                         @getsentry/bilby @getsentry/kowari
test/controllers/api/v2/identities_controller_test.rb                                                     @getsentry/bilby
test/controllers/api/v2/imports/tickets_controller_test.rb                                                @getsentry/ticket-platform
test/controllers/api/v2/incidents_controller_test.rb                                                      @getsentry/boxoffice @getsentry/popcorn
test/controllers/api/v2/incremental/automatic_answers_controller_test.rb                                  @getsentry/waratah
test/controllers/api/v2/incremental/organizations_controller_test.rb                                      @getsentry/kowari
test/controllers/api/v2/incremental/routing_controller_test.rb                                            @getsentry/argonauts
test/controllers/api/v2/incremental/ticket_events_controller_test.rb                                      @getsentry/dugong
test/controllers/api/v2/incremental/ticket_metric_events_controller_test.rb                               @getsentry/fang
test/controllers/api/v2/incremental/tickets_controller_test.rb                                            @getsentry/dugong
test/controllers/api/v2/incremental/users_controller_test.rb                                              @getsentry/bilby
test/controllers/api/v2/integrations/jira_controller_test.rb                                              @getsentry/pegasus
test/controllers/api/v2/internal/account_events_controller_test.rb                                        @getsentry/bilby @getsentry/quoll @getsentry/rakali
test/controllers/api/v2/internal/account_settings_controller_test.rb                                      @getsentry/teapot @getsentry/tealeaves
test/controllers/api/v2/internal/addon_boosts_controller_test.rb                                          @getsentry/narwhals @getsentry/otters
test/controllers/api/v2/internal/answer_bot/                                                              @getsentry/answer-bot
test/controllers/api/v2/internal/app_market/accounts_controller_test.rb                                   @getsentry/dingo
test/controllers/api/v2/internal/audit_emails_controller_test.rb                                          @getsentry/strongbad
test/controllers/api/v2/internal/audit_logs_controller_test.rb                                            @getsentry/audit-log
test/controllers/api/v2/internal/audits_controller_test.rb                                                @getsentry/fang @getsentry/libretto
test/controllers/api/v2/internal/base_controller_test.rb                                                  @getsentry/bolt
test/controllers/api/v2/internal/billing/                                                                 @getsentry/narwhals @getsentry/otters
test/controllers/api/v2/internal/boosts_controller_test.rb                                                @getsentry/narwhals @getsentry/otters
test/controllers/api/v2/internal/brands_controller_test.rb                                                @getsentry/boxoffice @getsentry/popcorn
test/controllers/api/v2/internal/certificate_moves_controller_test.rb                                     @getsentry/exodus @getsentry/secdev
test/controllers/api/v2/internal/certificates_controller_test.rb                                          @getsentry/secdev
test/controllers/api/v2/internal/challenge_token_controller_test.rb                                       @getsentry/secdev
test/controllers/api/v2/internal/chat/tickets_controller_test.rb                                          @getsentry/teapot @getsentry/tealeaves
test/controllers/api/v2/internal/collaboration/                                                           @getsentry/collaboration
test/controllers/api/v2/internal/compliance_moves_controller_test.rb                                      @getsentry/productivity-deploy
test/controllers/api/v2/internal/custom_roles_controller_test.rb                                          @getsentry/firefly
test/controllers/api/v2/internal/data_deletion_audits_controller_test.rb                                  @getsentry/account-data-deletion
test/controllers/api/v2/internal/emails_controller_test.rb                                                @getsentry/bilby @getsentry/space-dogs
test/controllers/api/v2/internal/entity_lookup/views_tickets_controller_test.rb                           @getsentry/ingest
test/controllers/api/v2/internal/entity_publication/views_tickets_controller_test.rb                      @getsentry/ingest
test/controllers/api/v2/internal/expirable_attachments_controller_test.rb                                 @getsentry/squonk
test/controllers/api/v2/internal/field_export_controller_test.rb                                          @getsentry/boxoffice @getsentry/popcorn
test/controllers/api/v2/internal/fraud*                                                                   @getsentry/orca
test/controllers/api/v2/internal/global_inbound_mail_rate_limits_controller_test.rb                       @getsentry/strongbad
test/controllers/api/v2/internal/gooddata_integration_controller_test.rb                                  @getsentry/waratah
test/controllers/api/v2/internal/help_center_states_controller_test.rb                                    @getsentry/guide-dev
test/controllers/api/v2/internal/inbound_mail_rate_limits_controller_test.rb                              @getsentry/strongbad
test/controllers/api/v2/internal/mobile_sdk_settings_controller_test.rb                                   @getsentry/lir
test/controllers/api/v2/internal/monitor/base_controller_test.rb                                          @getsentry/bolt
test/controllers/api/v2/internal/monitor/conditional_rate_limits_controller_test.rb                       @getsentry/bilby
test/controllers/api/v2/internal/monitor/entitlements_controller_test.rb                                  @getsentry/rakali
test/controllers/api/v2/internal/monitor/fraud*                                                           @getsentry/orca
test/controllers/api/v2/internal/monitor/mobile_sdk_app_settings_controller_test.rb                       @getsentry/lir
test/controllers/api/v2/internal/monitor/mobile_sdk_blips_controller_test.rb                              @getsentry/lir
test/controllers/api/v2/internal/monitor/subscriptions_controller_test.rb                                 @getsentry/narwhals @getsentry/otters
test/controllers/api/v2/internal/monitor_controller_test.rb                                               @getsentry/monitor
test/controllers/api/v2/internal/password_controller_test.rb                                              @getsentry/secdev @getsentry/unagi
test/controllers/api/v2/internal/pod_moves_controller_test.rb                                             @getsentry/exodus
test/controllers/api/v2/internal/prediction_settings_controller_test.rb                                   @getsentry/waratah
test/controllers/api/v2/internal/radar_controller_test.rb                                                 @getsentry/argonauts
test/controllers/api/v2/internal/recipient_addresses_controller_test.rb                                   @getsentry/strongbad
test/controllers/api/v2/internal/remote_authentications_controller_test.rb                                @getsentry/unagi
test/controllers/api/v2/internal/role_mapping_controller_test.rb                                          @getsentry/rakali
test/controllers/api/v2/internal/sandboxes_controller_test.rb                                             @getsentry/ngiyari @getsentry/pcc-operations
test/controllers/api/v2/internal/secondary_subscriptions_controller_test.rb                               @getsentry/narwhals @getsentry/otters
test/controllers/api/v2/internal/security_settings_controller_test.rb                                     @getsentry/secdev @getsentry/unagi
test/controllers/api/v2/internal/spf_verification_controller_test.rb                                      @getsentry/strongbad
test/controllers/api/v2/internal/staff_controller_test.rb                                                 @getsentry/turtle
test/controllers/api/v2/internal/staff_events_controller_test.rb                                          @getsentry/bilby
test/controllers/api/v2/internal/tickets_controller_test.rb                                               @getsentry/boxoffice @getsentry/popcorn
test/controllers/api/v2/internal/unmigrate_controller_test.rb                                             @getsentry/ticket-platform
test/controllers/api/v2/internal/user_otp_settings_controller_test.rb                                     @getsentry/secdev @getsentry/bilby
test/controllers/api/v2/internal/user_reports_controller_test.rb                                          @getsentry/bilby
test/controllers/api/v2/internal/users_controller_test.rb                                                 @getsentry/secdev @getsentry/bilby
test/controllers/api/v2/internal/voice/                                                                   @getsentry/voice
test/controllers/api/v2/internal/voyager/voyager_exports_controller_test.rb                               @getsentry/views-enablement
test/controllers/api/v2/internal/zopim/satisfaction_ratings_controller_test.rb                            @getsentry/fang
test/controllers/api/v2/internal/zopim_subscription_controller_test.rb                                    @getsentry/narwhals @getsentry/otters
test/controllers/api/v2/jetpack_tasks_controller_test.rb                                                  @getsentry/ponderosa
test/controllers/api/v2/job_statuses_controller_test.rb                                                   @getsentry/bolt
test/controllers/api/v2/mail_inline_images_controller_test.rb                                             @getsentry/strongbad
test/controllers/api/v2/mobile_devices_controller_test.rb                                                 @getsentry/lir
test/controllers/api/v2/mobile_sdk_apps_controller_test.rb                                                @getsentry/lir
test/controllers/api/v2/onboarding_tasks_controller_test.rb                                               @getsentry/ponderosa
test/controllers/api/v2/organization_memberships_controller_test.rb                                       @getsentry/kowari
test/controllers/api/v2/organizations_controller_test.rb                                                  @getsentry/kowari
test/controllers/api/v2/problems_controller_test.rb                                                       @getsentry/boxoffice @getsentry/popcorn
test/controllers/api/v2/products/suite_test.rb                                                            @getsentry/wallaby
test/controllers/api/v2/products_controller_test.rb                                                       @getsentry/wallaby
test/controllers/api/v2/push_notification_devices_controller_test.rb                                      @getsentry/lir
test/controllers/api/v2/recipient_addresses_controller_test.rb                                            @getsentry/strongbad
test/controllers/api/v2/relationship_sources_controller_test.rb                                           @getsentry/vinyl
test/controllers/api/v2/requests/                                                                         @getsentry/boxoffice @getsentry/popcorn
test/controllers/api/v2/requests_controller_test.rb                                                       @getsentry/boxoffice @getsentry/popcorn
test/controllers/api/v2/resend_owner_welcome_email_controller_test.rb                                     @getsentry/secdev
test/controllers/api/v2/resource_collections_controller_test.rb                                           @getsentry/dingo
test/controllers/api/v2/routing/                                                                          @getsentry/argonauts
test/controllers/api/v2/rules/                                                                            @getsentry/fang @getsentry/libretto
test/controllers/api/v2/rules/automations_controller_test.rb                                              @getsentry/libretto
test/controllers/api/v2/rules/categories/                                                                 @getsentry/libretto
test/controllers/api/v2/rules/macro*                                                                      @getsentry/fang
test/controllers/api/v2/rules/relationship_definitions_controller_test.rb                                 @getsentry/vinyl
test/controllers/api/v2/rules/trigger*                                                                    @getsentry/libretto
test/controllers/api/v2/rules/user_view*                                                                  @getsentry/penguin
test/controllers/api/v2/rules/views_controller_test.rb                                                    @getsentry/views-core @getsentry/views-enablement
test/controllers/api/v2/satisfaction_prediction_surveys_controller_test.rb                                @getsentry/fang
test/controllers/api/v2/satisfaction_ratings_controller_test.rb                                           @getsentry/fang
test/controllers/api/v2/satisfaction_reasons_controller_test.rb                                           @getsentry/fang
test/controllers/api/v2/search_controller_test.rb                                                         @getsentry/search
test/controllers/api/v2/sessions_controller_test.rb                                                       @getsentry/secdev
test/controllers/api/v2/sharing_agreements_controller_test.rb                                             @getsentry/boxoffice @getsentry/popcorn
test/controllers/api/v2/skips_controller_test.rb                                                          @getsentry/argonauts
test/controllers/api/v2/slas/                                                                             @getsentry/fang
test/controllers/api/v2/suspended_tickets_controller_test.rb                                              @getsentry/strongbad
test/controllers/api/v2/tags_controller_test.rb                                                           @getsentry/boxoffice @getsentry/popcorn
test/controllers/api/v2/target_failures_controller_test.rb                                                @getsentry/vegemite
test/controllers/api/v2/targets_controller_test.rb                                                        @getsentry/vegemite
test/controllers/api/v2/ticket_fields/custom_field_options_controller_test.rb                             @getsentry/boxoffice @getsentry/popcorn
test/controllers/api/v2/ticket_fields_controller_test.rb                                                  @getsentry/boxoffice @getsentry/popcorn @getsentry/vinyl
test/controllers/api/v2/ticket_forms_controller_test.rb                                                   @getsentry/boxoffice @getsentry/popcorn
test/controllers/api/v2/ticket_metrics_controller_test.rb                                                 @getsentry/fang
test/controllers/api/v2/tickets/attachments_controller_test.rb                                            @getsentry/boxoffice @getsentry/popcorn
test/controllers/api/v2/tickets/comments_controller_test.rb                                               @getsentry/orchid
test/controllers/api/v2/tickets_controller_test.rb                                                        @getsentry/boxoffice @getsentry/popcorn
test/controllers/api/v2/tracking/support_group_properties_controller_test.rb                              @getsentry/bolt @getsentry/bilby
test/controllers/api/v2/tracking/support_user_properties_controller_test.rb                               @getsentry/bilby
test/controllers/api/v2/user_fields/custom_field_options_controller_test.rb                               @getsentry/bilby @getsentry/vinyl
test/controllers/api/v2/users/compliance_deletion_statuses_controller_test.rb                             @getsentry/spyglass
test/controllers/api/v2/users/entitlements_controller_test.rb                                             @getsentry/bilby
test/controllers/api/v2/users/password_controller_test.rb                                                 @getsentry/secdev @getsentry/bilby @getsentry/unagi
test/controllers/api/v2/users/settings_controller_test.rb                                                 @getsentry/bilby
test/controllers/api/v2/users/user_seats_controller_test.rb                                               @getsentry/bilby @getsentry/voice
test/controllers/api/v2/users/zopim_identity_controller_test.rb                                           @getsentry/bilby
test/controllers/api/v2/users_controller_test.rb                                                          @getsentry/bilby
test/controllers/api/v2/voice/                                                                            @getsentry/voice
test/controllers/api/v2/workspaces_controller_test.rb                                                     @getsentry/kingfisher
test/controllers/api/v2beta/base_controller_test.rb                                                       @getsentry/bolt
test/controllers/api/v2beta/crm_controller_test.rb                                                        @getsentry/platycorn
test/controllers/api/v2beta/tickets/related_controller_test.rb                                            @getsentry/boxoffice @getsentry/popcorn
test/controllers/application_controller_test.rb                                                           @getsentry/bolt
test/controllers/attachment_token_controller_test.rb                                                      @getsentry/squonk
test/controllers/attachments_controller_test.rb                                                           @getsentry/squonk
test/controllers/audit_emails_controller_test.rb                                                          @getsentry/strongbad
test/controllers/automatic_answers_embed_controller_test.rb                                               @getsentry/waratah
test/controllers/brands_controller_test.rb                                                                @getsentry/boxoffice @getsentry/popcorn
test/controllers/certificate_signing_request_controller_test.rb                                           @getsentry/secdev
test/controllers/cms/base_controller_test.rb                                                              @getsentry/athene
test/controllers/cms/search_controller_test.rb                                                            @getsentry/athene
test/controllers/cms/texts_controller_test.rb                                                             @getsentry/athene
test/controllers/cms/variants_controller_test.rb                                                          @getsentry/athene
test/controllers/crm_controller_test.rb                                                                   @getsentry/platycorn
test/controllers/expirable_attachments_controller_test.rb                                                 @getsentry/squonk
test/controllers/external_email_credentials_controller_test.rb                                            @getsentry/strongbad
test/controllers/home_controller_test.rb                                                                  @getsentry/bolt
test/controllers/import_controller_test.rb                                                                @getsentry/bilby
test/controllers/jobs_controller_test.rb                                                                  @getsentry/bilby
test/controllers/logos_controller_test.rb                                                                 @getsentry/audit-log
test/controllers/lotus_bootstrap_controller_test.rb                                                       @getsentry/harrier
test/controllers/mobile/                                                                                  @getsentry/lir
test/controllers/password_reset_requests_controller_test.rb                                               @getsentry/secdev @getsentry/unagi
test/controllers/people/bulk_delete_controller_test.rb                                                    @getsentry/bilby
test/controllers/people/current_user_controller_test.rb                                                   @getsentry/bilby
test/controllers/people/groups_controller_test.rb                                                         @getsentry/bolt
test/controllers/people/organizations_controller_test.rb                                                  @getsentry/kowari
test/controllers/people/password_controller_test.rb                                                       @getsentry/secdev @getsentry/unagi
test/controllers/people/permanently_delete_users_controller_test.rb                                       @getsentry/spyglass @getsentry/bilby
test/controllers/people/search_controller_test.rb                                                         @getsentry/bilby @getsentry/search
test/controllers/people/tags_controller_test.rb                                                           @getsentry/boxoffice @getsentry/popcorn @getsentry/bilby
test/controllers/people/user_merge_controller_test.rb                                                     @getsentry/bilby
test/controllers/people/users_controller_test.rb                                                          @getsentry/bilby
test/controllers/registration_controller_test.rb                                                          @getsentry/bilby @getsentry/secdev
test/controllers/reports_controller_test.rb                                                               @getsentry/foundation-analytics-stream
test/controllers/requests/anonymous_controller_test.rb                                                    @getsentry/boxoffice @getsentry/popcorn
test/controllers/requests/embedded_controller_test.rb                                                     @getsentry/bolt
test/controllers/requests/mobile_api_controller_test.rb                                                   @getsentry/lir
test/controllers/requests/organization_controller_test.rb                                                 @getsentry/kowari
test/controllers/robots_controller_test.rb                                                                @getsentry/enigma
test/controllers/rules/                                                                                   @getsentry/fang @getsentry/libretto
test/controllers/rules/automations_controller_test.rb                                                     @getsentry/libretto
test/controllers/rules/triggers_controller_test.rb                                                        @getsentry/libretto
test/controllers/rules/views_controller_test.rb                                                           @getsentry/views-core @getsentry/views-enablement
test/controllers/satisfaction_ratings_controller_test.rb                                                  @getsentry/fang
test/controllers/settings/agents_controller_test.rb                                                       @getsentry/firefly
test/controllers/settings/base_controller_test.rb                                                         @getsentry/bolt
test/controllers/settings/channels_controller_test.rb                                                     @getsentry/ocean
test/controllers/settings/chat_controller_test.rb                                                         @getsentry/fangorn
test/controllers/settings/customers_controller_test.rb                                                    @getsentry/bilby
test/controllers/settings/email_controller_test.rb                                                        @getsentry/strongbad
test/controllers/settings/export_configuration_controller_test.rb                                         @getsentry/views-enablement
test/controllers/settings/extensions_controller_test.rb                                                   @getsentry/platycorn
test/controllers/settings/recipient_addresses_controller_test.rb                                          @getsentry/strongbad
test/controllers/settings/security_controller_test.rb                                                     @getsentry/secdev @getsentry/unagi
test/controllers/settings/slas_controller_test.rb                                                         @getsentry/fang
test/controllers/settings/tickets_controller_test.rb                                                      @getsentry/boxoffice @getsentry/popcorn
test/controllers/sharing/                                                                                 @getsentry/boxoffice @getsentry/popcorn
test/controllers/sharing_agreements_controller_test.rb                                                    @getsentry/boxoffice @getsentry/popcorn
test/controllers/survey_controller_test.rb                                                                @getsentry/belugas
test/controllers/suspended_tickets_controller_test.rb                                                     @getsentry/strongbad
test/controllers/tags_controller_test.rb                                                                  @getsentry/boxoffice @getsentry/popcorn
test/controllers/targets_controller_test.rb                                                               @getsentry/vegemite
test/controllers/ticket_deflection_controller_test.rb                                                     @getsentry/waratah
test/controllers/ticket_fields_controller_test.rb                                                         @getsentry/boxoffice @getsentry/popcorn @getsentry/vinyl
test/controllers/tickets/merge_controller_test.rb                                                         @getsentry/boxoffice @getsentry/popcorn
test/controllers/tickets_controller_test.rb                                                               @getsentry/boxoffice @getsentry/popcorn @getsentry/ticket-platform
test/controllers/twitter/reviewed_tweets_controller_test.rb                                               @getsentry/ocean
test/controllers/user_identities_controller_test.rb                                                       @getsentry/bilby
test/controllers/verification_controller_test.rb                                                          @getsentry/unagi
test/controllers/voice/                                                                                   @getsentry/voice
test/controllers/voyager/voyager_exports_controller_test.rb                                               @getsentry/views-enablement
test/controllers/zopim_chat_redirection_mixin_test.rb                                                     @getsentry/teapot @getsentry/tealeaves
test/controllers/zopim_chat_start_controller_test.rb                                                      @getsentry/teapot @getsentry/tealeaves
test/controllers/zuora/                                                                                   @getsentry/narwhals @getsentry/otters
test/factories/collaboration_factory.rb                                                                   @getsentry/strongbad
test/factories/compliance_deletion_feedback_factory.rb                                                    @getsentry/spyglass
test/factories/compliance_deletion_status_factory.rb                                                      @getsentry/spyglass
test/factories/custom_field_values_factory.rb                                                             @getsentry/vinyl
test/factories/custom_fields_factory.rb                                                                   @getsentry/vinyl
test/factories/custom_status_factory.rb                                                                   @getsentry/boxoffice @getsentry/popcorn
test/factories/email_fb_integration_factory.rb                                                            @getsentry/strongbad
test/factories/fraud_score_factory.rb                                                                     @getsentry/orca
test/factories/mobile_sdk*                                                                                @getsentry/lir
test/factories/relationship_field_index_factory.rb                                                        @getsentry/vinyl
test/factories/remote_authentication_factory.rb                                                           @getsentry/unagi
test/factories/request_token_factory.rb                                                                   @getsentry/lir
test/factories/rule_factory.rb                                                                            @getsentry/fang @getsentry/libretto
test/factories/sharing_agreement_factory.rb                                                               @getsentry/boxoffice @getsentry/popcorn
test/factories/suspended_ticket_factory.rb                                                                @getsentry/strongbad
test/factories/ticket_field_condition_factory.rb                                                          @getsentry/boxoffice @getsentry/popcorn
test/factories/ticket_field_factories.rb                                                                  @getsentry/boxoffice @getsentry/popcorn
test/factories/voice*                                                                                     @getsentry/voice
test/factories/voice/                                                                                     @getsentry/voice
test/factories/zopim/                                                                                     @getsentry/narwhals @getsentry/otters
test/files/account_stats.json                                                                             @getsentry/classic-core-cph
test/files/account_stats_missing.json                                                                     @getsentry/classic-core-cph
test/files/account_stats_null.json                                                                        @getsentry/classic-core-cph
test/files/allowed.5.2.yml                                                                                @getsentry/rails-upgrade
test/files/anychannel_api_responses/ris_index.json                                                        @getsentry/ocean
test/files/api_fixtures/v2-organizations-show.yml                                                         @getsentry/kowari
test/files/api_fixtures/v2-targets-show.yml                                                               @getsentry/vegemite
test/files/certificate/BigMoose.pem                                                                       @getsentry/secdev
test/files/certificate/EssentialSSLCA_2.crt                                                               @getsentry/secdev
test/files/certificate/account.crt                                                                        @getsentry/secdev
test/files/certificate/account.csr                                                                        @getsentry/secdev
test/files/certificate/account.key                                                                        @getsentry/secdev
test/files/certificate/ca.crt                                                                             @getsentry/secdev
test/files/certificate/ca.key                                                                             @getsentry/secdev
test/files/certificate/certs_json.txt                                                                     @getsentry/secdev
test/files/certificate/help.amadorlabs.com.crt                                                            @getsentry/secdev
test/files/certificate/malformed_san.crt                                                                  @getsentry/secdev
test/files/certificate/no_verify.crt                                                                      @getsentry/secdev
test/files/certificate/sha1.crt                                                                           @getsentry/secdev
test/files/certificate/sha1.key                                                                           @getsentry/secdev
test/files/certificate/subject_collision.crt                                                              @getsentry/secdev
test/files/certificate/support.crt                                                                        @getsentry/secdev
test/files/certificate/support.csr                                                                        @getsentry/secdev
test/files/certificate/support.key                                                                        @getsentry/secdev
test/files/deco/                                                                                          @getsentry/argonauts
test/files/facebook_message_conversation_entities.json                                                    @getsentry/ocean
test/files/facebook_message_send_api_response.json                                                        @getsentry/ocean
test/files/inbound_mailer/                                                                                @getsentry/strongbad
test/files/read_only_emails/                                                                              @getsentry/strongbad
test/files/resource_collection/                                                                           @getsentry/dingo
test/files/test_locales/js.yml                                                                            @getsentry/i18n
test/files/vcr_cassettes/                                                                                 @getsentry/secdev
test/files/voice*                                                                                         @getsentry/voice
test/files/voice/                                                                                         @getsentry/voice
test/fixtures/acme_certificate_job_statuses.yml                                                           @getsentry/secdev
test/fixtures/attachments.yml                                                                             @getsentry/squonk
test/fixtures/billing_cycles.yml                                                                          @getsentry/narwhals @getsentry/otters
test/fixtures/brands.yml                                                                                  @getsentry/boxoffice @getsentry/popcorn
test/fixtures/certificate_authorities.yml                                                                 @getsentry/secdev
test/fixtures/certificate_ips.yml                                                                         @getsentry/secdev
test/fixtures/certificates.yml                                                                            @getsentry/secdev
test/fixtures/cf_dropdown_choices.yml                                                                     @getsentry/vinyl
test/fixtures/cf_fields.yml                                                                               @getsentry/vinyl
test/fixtures/cf_values.yml                                                                               @getsentry/vinyl
test/fixtures/channels_brands.yml                                                                         @getsentry/ocean
test/fixtures/channels_resources.yml                                                                      @getsentry/ocean
test/fixtures/channels_user_profiles.yml                                                                  @getsentry/ocean
test/fixtures/credit_cards.yml                                                                            @getsentry/narwhals @getsentry/otters
test/fixtures/custom_field_options.yml                                                                    @getsentry/boxoffice @getsentry/popcorn
test/fixtures/custom_objects.yml                                                                          @getsentry/vinyl
test/fixtures/custom_statuses.yml                                                                         @getsentry/boxoffice @getsentry/popcorn
test/fixtures/events.yml                                                                                  @getsentry/ticket-platform
test/fixtures/expirable_attachments.yml                                                                   @getsentry/squonk
test/fixtures/external_email_credential.yml                                                               @getsentry/strongbad
test/fixtures/external_user_datas.yml                                                                     @getsentry/platycorn @getsentry/bilby
test/fixtures/groups.yml                                                                                  @getsentry/bolt @getsentry/teapot @getsentry/tealeaves
test/fixtures/incoming_channels_conversions.yml                                                           @getsentry/ocean
test/fixtures/instance_values.yml                                                                         @getsentry/argonauts
test/fixtures/jira_issues.yml                                                                             @getsentry/pegasus
test/fixtures/memberships.yml                                                                             @getsentry/bolt @getsentry/bilby
test/fixtures/mobile_sdk*                                                                                 @getsentry/lir
test/fixtures/organization_domains.yml                                                                    @getsentry/kowari
test/fixtures/organization_emails.yml                                                                     @getsentry/kowari
test/fixtures/organization_memberships.yml                                                                @getsentry/kowari
test/fixtures/organizations.yml                                                                           @getsentry/kowari
test/fixtures/payments.yml                                                                                @getsentry/narwhals @getsentry/otters
test/fixtures/permission_sets.yml                                                                         @getsentry/space-dogs @getsentry/firefly
test/fixtures/recipient_addresses.yml                                                                     @getsentry/strongbad
test/fixtures/remote_authentications.yml                                                                  @getsentry/unagi
test/fixtures/routes.yml                                                                                  @getsentry/boxoffice @getsentry/popcorn
test/fixtures/rules.yml                                                                                   @getsentry/fang @getsentry/libretto
test/fixtures/sequences.yml                                                                               @getsentry/ticket-platform
test/fixtures/subscription_features.yml                                                                   @getsentry/narwhals @getsentry/otters
test/fixtures/subscriptions.yml                                                                           @getsentry/narwhals @getsentry/otters
test/fixtures/suspended_tickets.yml                                                                       @getsentry/strongbad
test/fixtures/targets.yml                                                                                 @getsentry/vegemite
test/fixtures/ticket_deflection_articles.yml                                                              @getsentry/waratah
test/fixtures/ticket_deflections.yml                                                                      @getsentry/waratah
test/fixtures/ticket_fields.yml                                                                           @getsentry/boxoffice @getsentry/popcorn @getsentry/vinyl
test/fixtures/ticket_forms.yml                                                                            @getsentry/boxoffice @getsentry/popcorn
test/fixtures/tickets.yml                                                                                 @getsentry/boxoffice @getsentry/popcorn
test/fixtures/tokens.yml                                                                                  @getsentry/secdev
test/fixtures/users.yml                                                                                   @getsentry/bilby
test/fixtures/voice*                                                                                      @getsentry/voice
test/fixtures/workspaces.yml                                                                              @getsentry/kingfisher
test/fixtures/zopim_agents.yml                                                                            @getsentry/bilby
test/fixtures/zopim_subscriptions.yml                                                                     @getsentry/narwhals @getsentry/otters
test/fixtures/zuora_coupon_redemptions.yml                                                                @getsentry/narwhals @getsentry/otters
test/fixtures/zuora_coupons.yml                                                                           @getsentry/narwhals @getsentry/otters
test/helpers/admin_helper_test.rb                                                                         @getsentry/fang @getsentry/libretto
test/helpers/api/v2/internal/security_settings_errors_formatter_helper_test.rb                            @getsentry/secdev @getsentry/unagi
test/helpers/audits_helper_test.rb                                                                        @getsentry/audit-log
test/helpers/automatic_answers/authentication_helper_test.rb                                              @getsentry/waratah
test/helpers/automatic_answers/tagging_helper_test.rb                                                     @getsentry/waratah
test/helpers/cms/view_helper_test.rb                                                                      @getsentry/athene
test/helpers/country_helper_test.rb                                                                       @getsentry/red-pandas
test/helpers/db_error_helper_test.rb                                                                      @getsentry/classic-core-cph
test/helpers/emoji_helper_test.rb                                                                         @getsentry/orchid
test/helpers/import_helper_test.rb                                                                        @getsentry/penguin
test/helpers/java_script_helper_test.rb                                                                   @getsentry/classic-core-cph
test/helpers/ledger_rate_limit_helper_test.rb                                                             @getsentry/bilby
test/helpers/lotus_bootstrap_helper_test.rb                                                               @getsentry/harrier
test/helpers/merge_helper_test.rb                                                                         @getsentry/strongbad
test/helpers/organizations_helper_test.rb                                                                 @getsentry/kowari
test/helpers/people/                                                                                      @getsentry/bilby
test/helpers/people_helper_test.rb                                                                        @getsentry/penguin
test/helpers/rules_analysis_helper_test.rb                                                                @getsentry/fang @getsentry/libretto
test/helpers/rules_helper_test.rb                                                                         @getsentry/fang @getsentry/views-core @getsentry/views-enablement @getsentry/libretto
test/helpers/satisfaction_ratings_helper_test.rb                                                          @getsentry/fang
test/helpers/settings/email_helper_test.rb                                                                @getsentry/strongbad
test/helpers/settings/security_helper_test.rb                                                             @getsentry/secdev @getsentry/unagi
test/helpers/settings/slas_helper_test.rb                                                                 @getsentry/fang
test/helpers/sharing/agreements_helper_test.rb                                                            @getsentry/boxoffice @getsentry/popcorn
test/helpers/suspended_tickets_helper_test.rb                                                             @getsentry/strongbad
test/helpers/tags_helper_test.rb                                                                          @getsentry/boxoffice @getsentry/popcorn
test/helpers/targets_helper_test.rb                                                                       @getsentry/vegemite
test/helpers/ticket_trace_helper_test.rb                                                                  @getsentry/boxoffice @getsentry/popcorn
test/helpers/triggers_helper_test.rb                                                                      @getsentry/libretto
test/helpers/user_identities_helper_test.rb                                                               @getsentry/bilby
test/helpers/user_interface_helper_test.rb                                                                @getsentry/bilby
test/helpers/users_helper_test.rb                                                                         @getsentry/bilby
test/helpers/workspaces_helper_test.rb                                                                    @getsentry/kingfisher
test/integration/acme_challenges_test.rb                                                                  @getsentry/secdev
test/integration/api/mobile/                                                                              @getsentry/lir
test/integration/api/v2/attachments_and_tickets_test.rb                                                   @getsentry/spyglass
test/integration/api/v2/incremental/incremental_organizations_export_test.rb                              @getsentry/kowari
test/integration/api/v2/incremental/incremental_ticket_events_export_test.rb                              @getsentry/dugong
test/integration/api/v2/incremental/incremental_ticket_export_test.rb                                     @getsentry/dugong
test/integration/api/v2/incremental/incremental_users_export_test.rb                                      @getsentry/bilby
test/integration/api/v2/session_api_test.rb                                                               @getsentry/secdev
test/integration/archive_v2_integration_test.rb                                                           @getsentry/support-ticket-archiving
test/integration/authentication/login_logout_events_test.rb                                               @getsentry/argonauts
test/integration/authentication/mobile_sdk_set_user_locale_test.rb                                        @getsentry/lir
test/integration/authentication/social/facebook_authentication_test.rb                                    @getsentry/unagi
test/integration/boot_without_account_master_test.rb                                                      @getsentry/ticket-platform
test/integration/channels/                                                                                @getsentry/ocean
test/integration/cleanliness_test.rb                                                                      @getsentry/bolt
test/integration/controllers/                                                                             @getsentry/waratah
test/integration/json_test.rb                                                                             @getsentry/bolt
test/integration/lotus_redirector_test.rb                                                                 @getsentry/harrier
test/integration/mail/                                                                                    @getsentry/strongbad
test/integration/mobile_integration_test.rb                                                               @getsentry/lir
test/integration/models/answer_bot/                                                                       @getsentry/answer-bot
test/integration/oauth_session_doorman_test.rb                                                            @getsentry/secdev
test/integration/page_not_found_test.rb                                                                   @getsentry/ruby-core
test/integration/rails_same_site_cookie_test.rb                                                           @getsentry/secdev
test/integration/rails_sanitizer_test.rb                                                                  @getsentry/squonk
test/integration/redaction_with_email_storage_service_test.rb                                             @getsentry/strongbad
test/integration/rules_count_test.rb                                                                      @getsentry/fang @getsentry/libretto
test/integration/rules_test.rb                                                                            @getsentry/fang @getsentry/libretto
test/integration/settings/email_settings_test.rb                                                          @getsentry/strongbad
test/integration/stores_backfiller_integration_test.rb                                                    @getsentry/squonk
test/integration/support_activation_test.rb                                                               @getsentry/bilby
test/integration/targets_controller_test.rb                                                               @getsentry/vegemite
test/integration/verification_controller_test.rb                                                          @getsentry/classic-core-cph
test/integration/zendesk_auth_assets_test.rb                                                              @getsentry/unagi
test/integration/zendesk_i18n_dev_tools_test.rb                                                           @getsentry/i18n
test/lib/acme_reporter_test.rb                                                                            @getsentry/secdev
test/lib/active_record_ttl_support_test.rb                                                                @getsentry/bolt
test/lib/automatic_answers_jwt_token_test.rb                                                              @getsentry/waratah
test/lib/billing/                                                                                         @getsentry/narwhals @getsentry/otters
test/lib/billing/accounts/                                                                                @getsentry/belugas
test/lib/billing/cancellation_request/                                                                    @getsentry/belugas
test/lib/billing_cycle_type_test.rb                                                                       @getsentry/narwhals @getsentry/otters
test/lib/bulk_job_data/                                                                                   @getsentry/bolt
test/lib/bulk_job_data_test.rb                                                                            @getsentry/bolt
test/lib/cia_controller_support_test.rb                                                                   @getsentry/audit-log
test/lib/cia_event_creator_test.rb                                                                        @getsentry/audit-log
test/lib/classic_gc_knobs_test.rb                                                                         @getsentry/bolt
test/lib/codepath_execution_test.rb                                                                       @getsentry/classic-core-cph
test/lib/content_url_builder_test.rb                                                                      @getsentry/piratos
test/lib/custom_backtrace_cleaner_test.rb                                                                 @getsentry/bolt
test/lib/datadog/answer_bot_test.rb                                                                       @getsentry/waratah
test/lib/fraud/                                                                                           @getsentry/orca
test/lib/hash_param_test.rb                                                                               @getsentry/rails-upgrade
test/lib/hc_uploader_configuration_test.rb                                                                @getsentry/squonk @getsentry/account-data-deletion
test/lib/in_flight_job_limiter_test.rb                                                                    @getsentry/bolt
test/lib/job_v3/                                                                                          @getsentry/bolt
test/lib/job_v3_test.rb                                                                                   @getsentry/bolt
test/lib/job_with_status_tracking_test.rb                                                                 @getsentry/bolt
test/lib/json_with_yaml_fallback_coder_test.rb                                                            @getsentry/rails-upgrade
test/lib/kpod_arturo_test.rb                                                                              @getsentry/bolt
test/lib/kragle_connection/answer_bot_service_test.rb                                                     @getsentry/waratah @getsentry/classic-core-cph
test/lib/kragle_connection/app_market_test.rb                                                             @getsentry/dingo @getsentry/classic-core-cph
test/lib/kragle_connection/billing_test.rb                                                                @getsentry/belugas
test/lib/kragle_connection/explore_test.rb                                                                @getsentry/classic-core-cph
test/lib/kragle_connection/feedback_support_test.rb                                                       @getsentry/strongbad @getsentry/classic-core-cph
test/lib/kragle_connection/hc_locales_test.rb                                                             @getsentry/lir @getsentry/classic-core-cph
test/lib/kragle_connection/help_center_test.rb                                                            @getsentry/piratos @getsentry/classic-core-cph
test/lib/kragle_connection/pigeon_test.rb                                                                 @getsentry/lir @getsentry/classic-core-cph
test/lib/kragle_connection/sharing_agreement_test.rb                                                      @getsentry/boxoffice @getsentry/popcorn @getsentry/classic-core-cph
test/lib/kragle_connection/side_conversations_test.rb                                                     @getsentry/collaboration @getsentry/classic-core-cph
test/lib/kragle_connection/sunshine_test.rb                                                               @getsentry/echidna @getsentry/classic-core-cph
test/lib/kragle_connection/voice_test.rb                                                                  @getsentry/voice @getsentry/classic-core-cph
test/lib/kragle_connection_test.rb                                                                        @getsentry/squonk @getsentry/classic-core-cph
test/lib/lazy_hybrid_cookie_serializer_test.rb                                                            @getsentry/bolt
test/lib/middleware_timing_test.rb                                                                        @getsentry/bolt
test/lib/mobile_session_preservation_test.rb                                                              @getsentry/lir
test/lib/page_not_found_rendering_support_test.rb                                                         @getsentry/ruby-core
test/lib/product_limits/controllers_test.rb                                                               @getsentry/boxoffice @getsentry/popcorn
test/lib/product_limits/scaling_strategies/                                                               @getsentry/boxoffice @getsentry/popcorn
test/lib/product_limits/user_tickets_controllers_test.rb                                                  @getsentry/boxoffice @getsentry/popcorn
test/lib/pry-rails/prompt_test.rb                                                                         @getsentry/ticket-platform
test/lib/rails4_compatible_serializer_test.rb                                                             @getsentry/rails-upgrade
test/lib/rails_5_param_hash_regression_test.rb                                                            @getsentry/rails-upgrade
test/lib/tag_management_test.rb                                                                           @getsentry/boxoffice @getsentry/popcorn
test/lib/tessa/                                                                                           @getsentry/harrier
test/lib/web_portal_attachment_policies_test.rb                                                           @getsentry/classic-core-cph
test/lib/zendesk/account_readiness_test.rb                                                                @getsentry/quoll
test/lib/zendesk/account_stats_mysql_test.rb                                                              @getsentry/classic-core-cph
test/lib/zendesk/account_stats_s3_test.rb                                                                 @getsentry/classic-core-cph
test/lib/zendesk/account_stats_test.rb                                                                    @getsentry/classic-core-cph
test/lib/zendesk/accounts/                                                                                @getsentry/bilby
test/lib/zendesk/accounts/client_test.rb                                                                  @getsentry/rakali
test/lib/zendesk/accounts/custom_roles_resolver_test.rb                                                   @getsentry/firefly
test/lib/zendesk/accounts/feature_boost_support_test.rb                                                   @getsentry/rakali
test/lib/zendesk/accounts/product_test.rb                                                                 @getsentry/bilby @getsentry/rakali
test/lib/zendesk/accounts/rate_limiting_test.rb                                                           @getsentry/boxoffice @getsentry/popcorn
test/lib/zendesk/accounts/role_mapping_support_test.rb                                                    @getsentry/rakali
test/lib/zendesk/accounts/security/                                                                       @getsentry/secdev
test/lib/zendesk/accounts/sku_test.rb                                                                     @getsentry/rakali
test/lib/zendesk/accounts/support_product_mapper_test.rb                                                  @getsentry/bilby
test/lib/zendesk/active_record_datadog_sql_span_tags_test.rb                                              @getsentry/bolt
test/lib/zendesk/answer_bot_service/internal_api_client_test.rb                                           @getsentry/waratah
test/lib/zendesk/app_market_client_v2_test.rb                                                             @getsentry/classic-core-cph @getsentry/dingo
test/lib/zendesk/archive/                                                                                 @getsentry/support-ticket-archiving
test/lib/zendesk/arturo_slider_test.rb                                                                    @getsentry/views-core @getsentry/views-enablement
test/lib/zendesk/ask/                                                                                     @getsentry/argonauts
test/lib/zendesk/attachments/stores_test.rb                                                               @getsentry/squonk
test/lib/zendesk/audit_logs/audit_event_kafka_publisher_test.rb                                           @getsentry/audit-log
test/lib/zendesk/audit_logs/audit_event_publisher_test.rb                                                 @getsentry/kowari @getsentry/audit-log
test/lib/zendesk/audit_logs/base_audit_event_test.rb                                                      @getsentry/kowari @getsentry/audit-log
test/lib/zendesk/audit_logs/update_audit_event_test.rb                                                    @getsentry/kowari @getsentry/audit-log
test/lib/zendesk/auth/                                                                                    @getsentry/secdev @getsentry/unagi
test/lib/zendesk/auth/authentication_event_publisher_test.rb                                              @getsentry/argonauts
test/lib/zendesk/auth/warden/callbacks/ask_publish_login_event_test.rb                                    @getsentry/argonauts
test/lib/zendesk/auth/warden/callbacks/ask_publish_logout_event_test.rb                                   @getsentry/argonauts
test/lib/zendesk/auth/warden/callbacks/set_mobile_sdk_user_locale_test.rb                                 @getsentry/lir
test/lib/zendesk/authenticated_session_test.rb                                                            @getsentry/secdev @getsentry/unagi
test/lib/zendesk/auto_translation/                                                                        @getsentry/polo
test/lib/zendesk/brand_creator_test.rb                                                                    @getsentry/boxoffice @getsentry/popcorn
test/lib/zendesk/business_hours_support/                                                                  @getsentry/fang
test/lib/zendesk/ccs_and_followers/                                                                       @getsentry/strongbad
test/lib/zendesk/certificate/mover_test.rb                                                                @getsentry/exodus @getsentry/secdev
test/lib/zendesk/certificate/store_test.rb                                                                @getsentry/secdev
test/lib/zendesk/channels/                                                                                @getsentry/ocean
test/lib/zendesk/chat/                                                                                    @getsentry/teapot @getsentry/tealeaves
test/lib/zendesk/chat_transcripts/                                                                        @getsentry/teapot @getsentry/tealeaves
test/lib/zendesk/cloudflare_rate_limiting_test.rb                                                         @getsentry/orca
test/lib/zendesk/cms/export_job_test.rb                                                                   @getsentry/athene
test/lib/zendesk/cms/exporter_test.rb                                                                     @getsentry/athene
test/lib/zendesk/cms/import_job_test.rb                                                                   @getsentry/athene
test/lib/zendesk/cms/importer_test.rb                                                                     @getsentry/athene
test/lib/zendesk/comment_on_controller_queries_test.rb                                                    @getsentry/classic-core-cph
test/lib/zendesk/comment_on_middleware_queries_test.rb                                                    @getsentry/classic-core-cph
test/lib/zendesk/comment_publicity_test.rb                                                                @getsentry/boxoffice @getsentry/popcorn
test/lib/zendesk/concurrency_limiter_config_test.rb                                                       @getsentry/bolt
test/lib/zendesk/connection_recycling/                                                                    @getsentry/bolt
test/lib/zendesk/controller_owner_tagging_test.rb                                                         @getsentry/classic-core-cph
test/lib/zendesk/controller_request_timeout_test.rb                                                       @getsentry/classic-core-cph
test/lib/zendesk/cursor_pagination/                                                                       @getsentry/boxoffice @getsentry/popcorn @getsentry/bilby
test/lib/zendesk/custom_field/                                                                            @getsentry/boxoffice @getsentry/popcorn @getsentry/vinyl
test/lib/zendesk/custom_statuses/                                                                         @getsentry/boxoffice @getsentry/popcorn
test/lib/zendesk/data_deletion/                                                                           @getsentry/account-data-deletion
test/lib/zendesk/data_deletion/doorman_client_test.rb                                                     @getsentry/guide-search
test/lib/zendesk/database_backoff_test.rb                                                                 @getsentry/gecko
test/lib/zendesk/datadog_trace_helper_test.rb                                                             @getsentry/boxoffice @getsentry/popcorn
test/lib/zendesk/db_runtime_subscriber_test.rb                                                            @getsentry/capacity-planning @getsentry/bolt
test/lib/zendesk/deco/                                                                                    @getsentry/argonauts
test/lib/zendesk/doorman_client_test.rb                                                                   @getsentry/rakali
test/lib/zendesk/doorman_header_support_test.rb                                                           @getsentry/secdev
test/lib/zendesk/enterprise_recaptcha_test.rb                                                             @getsentry/orca
test/lib/zendesk/entitlement_test.rb                                                                      @getsentry/bilby @getsentry/rakali
test/lib/zendesk/entitlements_client_test.rb                                                              @getsentry/rakali
test/lib/zendesk/entity_publication/                                                                      @getsentry/ingest
test/lib/zendesk/events/audit_events/array_value_truncation_test.rb                                       @getsentry/strongbad
test/lib/zendesk/events/controller_support_test.rb                                                        @getsentry/ticket-platform
test/lib/zendesk/explore/internal_api_client_test.rb                                                      @getsentry/kepler
test/lib/zendesk/export/archived_audit_exporter_test.rb                                                   @getsentry/ticket-platform
test/lib/zendesk/export/audit_pager_test.rb                                                               @getsentry/ticket-platform
test/lib/zendesk/export/incremental_export_archive_finder_test.rb                                         @getsentry/dugong
test/lib/zendesk/export/incremental_export_finder_test.rb                                                 @getsentry/dugong
test/lib/zendesk/export/incremental_export_test.rb                                                        @getsentry/dugong
test/lib/zendesk/export/incremental_export_user_finder_test.rb                                            @getsentry/bilby
test/lib/zendesk/export/incremental_ticket_events_finder_test.rb                                          @getsentry/dugong
test/lib/zendesk/export/incremental_ticket_export_test.rb                                                 @getsentry/dugong
test/lib/zendesk/export/incremental_ticket_metric_events_cbp_finder_test.rb                               @getsentry/fang
test/lib/zendesk/export/incremental_ticket_metric_events_finder_test.rb                                   @getsentry/fang
test/lib/zendesk/extensions/ar_skipped_callback_metrics_test.rb                                           @getsentry/ingest
test/lib/zendesk/extensions/ar_update_attribute_test.rb                                                   @getsentry/rails-upgrade
test/lib/zendesk/extensions/cia_test.rb                                                                   @getsentry/audit-log
test/lib/zendesk/extensions/mail_test.rb                                                                  @getsentry/strongbad
test/lib/zendesk/extensions/mysql2_spanid_injection_test.rb                                               @getsentry/performance-wizards
test/lib/zendesk/extensions/rack_trusted_proxy_test.rb                                                    @getsentry/bolt
test/lib/zendesk/extensions/resque/graceful_shutdown_test.rb                                              @getsentry/bolt
test/lib/zendesk/extensions/resque/retry_key_with_queue_test.rb                                           @getsentry/bolt
test/lib/zendesk/extensions/resque/worker_test.rb                                                         @getsentry/gecko
test/lib/zendesk/extensions/ticket_sharing_test.rb                                                        @getsentry/boxoffice @getsentry/popcorn
test/lib/zendesk/external_permissions/                                                                    @getsentry/space-dogs @getsentry/firefly
test/lib/zendesk/features/catalogs/                                                                       @getsentry/narwhals @getsentry/otters
test/lib/zendesk/features/change/custom_security_policy_change_test.rb                                    @getsentry/secdev
test/lib/zendesk/features/change/custom_session_timeout_change_test.rb                                    @getsentry/secdev
test/lib/zendesk/features/change/customer_satisfaction_change_test.rb                                     @getsentry/fang
test/lib/zendesk/features/change/group_rules_change_test.rb                                               @getsentry/bolt @getsentry/bilby @getsentry/fang
test/lib/zendesk/features/change/groups_change_test.rb                                                    @getsentry/bolt
test/lib/zendesk/features/change/multiple_organizations_change_test.rb                                    @getsentry/kowari
test/lib/zendesk/features/change/organizations_change_test.rb                                             @getsentry/kowari
test/lib/zendesk/features/change/permission_sets_change_test.rb                                           @getsentry/space-dogs
test/lib/zendesk/features/change/play_tickets_advanced_change_test.rb                                     @getsentry/argonauts
test/lib/zendesk/features/change/sandbox_change_test.rb                                                   @getsentry/ngiyari @getsentry/pcc-operations
test/lib/zendesk/features/change/talk_cti_partner_change_test.rb                                          @getsentry/zenguins
test/lib/zendesk/features/change/ticket_threads_change_test.rb                                            @getsentry/collaboration
test/lib/zendesk/features/change/unlimited_automations_change_test.rb                                     @getsentry/libretto
test/lib/zendesk/features/change/unlimited_rules_change_test.rb                                           @getsentry/fang @getsentry/libretto
test/lib/zendesk/features/change/unlimited_triggers_change_test.rb                                        @getsentry/libretto
test/lib/zendesk/features/change/unlimited_views_change_test.rb                                           @getsentry/fang
test/lib/zendesk/features/overrides/simple_price_packaging_test.rb                                        @getsentry/rakali
test/lib/zendesk/features/subscription_feature_service_test.rb                                            @getsentry/rakali
test/lib/zendesk/gdpr/configuration_test.rb                                                               @getsentry/spyglass
test/lib/zendesk/gooddata/                                                                                @getsentry/waratah
test/lib/zendesk/group_memberships/finder_test.rb                                                         @getsentry/bolt @getsentry/bilby
test/lib/zendesk/i18n/fallbacks_test.rb                                                                   @getsentry/bolt @getsentry/i18n
test/lib/zendesk/i18n/language_settlement_test.rb                                                         @getsentry/lir
test/lib/zendesk/i18n/translation_files_test.rb                                                           @getsentry/bolt @getsentry/i18n
test/lib/zendesk/idempotency/                                                                             @getsentry/teapot @getsentry/tealeaves
test/lib/zendesk/idempotency_test.rb                                                                      @getsentry/teapot @getsentry/tealeaves
test/lib/zendesk/inbound_mail/                                                                            @getsentry/strongbad
test/lib/zendesk/inbound_mail/processors/atsd_processor_test.rb                                           @getsentry/orca
test/lib/zendesk/inbound_mail/processors/fraud_signals_processor_test.rb                                  @getsentry/orca
test/lib/zendesk/inbound_mail/processors/phishing_tag_processor_test.rb                                   @getsentry/strongbad
test/lib/zendesk/inbound_mail/processors/reply_to_processor_test.rb                                       @getsentry/strongbad
test/lib/zendesk/inbound_mail_test.rb                                                                     @getsentry/strongbad
test/lib/zendesk/incidents/finder_test.rb                                                                 @getsentry/boxoffice @getsentry/popcorn
test/lib/zendesk/limited_cache_test.rb                                                                    @getsentry/bolt
test/lib/zendesk/liquid/answer_bot/                                                                       @getsentry/waratah
test/lib/zendesk/liquid/cms_drop_test.rb                                                                  @getsentry/athene
test/lib/zendesk/liquid/comments/comment_drop_test.rb                                                     @getsentry/strongbad
test/lib/zendesk/liquid/comments/plain_comment_drop_test.rb                                               @getsentry/strongbad
test/lib/zendesk/liquid/comments/voice_comment_body_drop_test.rb                                          @getsentry/voice
test/lib/zendesk/liquid/footer/footer_drop_test.rb                                                        @getsentry/strongbad
test/lib/zendesk/liquid/mail_context_test.rb                                                              @getsentry/strongbad
test/lib/zendesk/liquid/placeholder_suppression_test.rb                                                   @getsentry/strongbad
test/lib/zendesk/liquid/pre_processing/footer_style_injector_test.rb                                      @getsentry/strongbad
test/lib/zendesk/liquid/satisfaction_rating_drop_test.rb                                                  @getsentry/fang
test/lib/zendesk/liquid/ticket_context_test.rb                                                            @getsentry/boxoffice @getsentry/popcorn
test/lib/zendesk/locale_presentation_test.rb                                                              @getsentry/i18n
test/lib/zendesk/mail_inline_images_controller_support_test.rb                                            @getsentry/strongbad
test/lib/zendesk/mailer/                                                                                  @getsentry/strongbad
test/lib/zendesk/maintenance/jobs/account_pruning_job_test.rb                                             @getsentry/quoll
test/lib/zendesk/maintenance/jobs/account_risk_assessment_job_test.rb                                     @getsentry/orca
test/lib/zendesk/maintenance/jobs/acme_certificate_renewal_job_test.rb                                    @getsentry/secdev
test/lib/zendesk/maintenance/jobs/agent_workspace_auto_activation_job_test.rb                             @getsentry/iris
test/lib/zendesk/maintenance/jobs/agent_workspace_mark_accounts_for_auto_activation_job_test.rb           @getsentry/iris
test/lib/zendesk/maintenance/jobs/api_activity_delete_job_test.rb                                         @getsentry/bolt
test/lib/zendesk/maintenance/jobs/api_activity_to_database_job_test.rb                                    @getsentry/bolt
test/lib/zendesk/maintenance/jobs/ask_account_onboarding_test.rb                                          @getsentry/silk-road
test/lib/zendesk/maintenance/jobs/ask_onboarding_test.rb                                                  @getsentry/silk-road
test/lib/zendesk/maintenance/jobs/automation_job_test.rb                                                  @getsentry/libretto
test/lib/zendesk/maintenance/jobs/base_data_delete_job_test.rb                                            @getsentry/account-data-deletion
test/lib/zendesk/maintenance/jobs/base_data_deletion_participant_job_test.rb                              @getsentry/account-data-deletion
test/lib/zendesk/maintenance/jobs/bulk_job_data_cleanup_job_test.rb                                       @getsentry/bolt
test/lib/zendesk/maintenance/jobs/certificate_maintenance_job_test.rb                                     @getsentry/secdev
test/lib/zendesk/maintenance/jobs/compliance_user_deletion_feedback_job_test.rb                           @getsentry/spyglass
test/lib/zendesk/maintenance/jobs/compliance_user_deletion_job_test.rb                                    @getsentry/bilby
test/lib/zendesk/maintenance/jobs/compliance_user_deletion_requeue_job_test.rb                            @getsentry/spyglass
test/lib/zendesk/maintenance/jobs/conditional_rate_limits_cleanup_job_test.rb                             @getsentry/bilby
test/lib/zendesk/maintenance/jobs/daily_ticket_close_on_shard_job_test.rb                                 @getsentry/ticket-platform
test/lib/zendesk/maintenance/jobs/deprovision_gooddata_job_test.rb                                        @getsentry/waratah
test/lib/zendesk/maintenance/jobs/organization_membership_cleanup_job_test.rb                             @getsentry/kowari
test/lib/zendesk/maintenance/jobs/remove_actor_management_service_data_job_test.rb                        @getsentry/soju
test/lib/zendesk/maintenance/jobs/remove_agent_state_management_service_data_job_test.rb                  @getsentry/kopi
test/lib/zendesk/maintenance/jobs/remove_answer_bot_flow_composer_data_job_test.rb                        @getsentry/koalai
test/lib/zendesk/maintenance/jobs/remove_answer_bot_flow_director_data_job_test.rb                        @getsentry/aha-pandai
test/lib/zendesk/maintenance/jobs/remove_attachments_from_cloud_job_test.rb                               @getsentry/account-data-deletion
test/lib/zendesk/maintenance/jobs/remove_certificates_job_test.rb                                         @getsentry/account-data-deletion
test/lib/zendesk/maintenance/jobs/remove_collaboration_data_job_test.rb                                   @getsentry/collaboration
test/lib/zendesk/maintenance/jobs/remove_conversational_ml_data_job_test.rb                               @getsentry/ml-apac-numbats
test/lib/zendesk/maintenance/jobs/remove_custom_resources_job_test.rb                                     @getsentry/vinyl
test/lib/zendesk/maintenance/jobs/remove_embeddings_after_delete_job_test.rb                              @getsentry/waratah
test/lib/zendesk/maintenance/jobs/remove_explore_data_job_test.rb                                         @getsentry/kepler
test/lib/zendesk/maintenance/jobs/remove_export_artefacts_job_test.rb                                     @getsentry/account-data-deletion
test/lib/zendesk/maintenance/jobs/remove_flow_builder_conversational_shortcuts_data_job_test.rb           @getsentry/koalai
test/lib/zendesk/maintenance/jobs/remove_gooddata_integration_job_test.rb                                 @getsentry/account-data-deletion
test/lib/zendesk/maintenance/jobs/remove_guide_external_content_participant_data_job_test.rb              @getsentry/guide-search
test/lib/zendesk/maintenance/jobs/remove_hc_attachments_job_test.rb                                       @getsentry/account-data-deletion
test/lib/zendesk/maintenance/jobs/remove_hc_entities_participant_job_test.rb                              @getsentry/guide-search
test/lib/zendesk/maintenance/jobs/remove_legion_data_job_test.rb                                          @getsentry/account-data-deletion
test/lib/zendesk/maintenance/jobs/remove_ml_triage_data_participant_job_test.rb                           @getsentry/lynx
test/lib/zendesk/maintenance/jobs/remove_onboarding_experience_service_data_job_test.rb                   @getsentry/ponderosa
test/lib/zendesk/maintenance/jobs/remove_pigeon_data_job_test.rb                                          @getsentry/account-data-deletion
test/lib/zendesk/maintenance/jobs/remove_platform_logs_data_job_test.rb                                   @getsentry/dugong
test/lib/zendesk/maintenance/jobs/remove_riak_data_job_test.rb                                            @getsentry/ticket-platform
test/lib/zendesk/maintenance/jobs/remove_s3_inbound_email_job_test.rb                                     @getsentry/strongbad
test/lib/zendesk/maintenance/jobs/remove_sell_data_job_test.rb                                            @getsentry/sell-core-services
test/lib/zendesk/maintenance/jobs/remove_shard_data_job_test.rb                                           @getsentry/account-data-deletion
test/lib/zendesk/maintenance/jobs/remove_sunshine_events_profiles_job_test.rb                             @getsentry/echidna
test/lib/zendesk/maintenance/jobs/remove_text_matching_ml_data_job_test.rb                                @getsentry/ml-apac-numbats
test/lib/zendesk/maintenance/jobs/remove_voice_data_job_test.rb                                           @getsentry/voice
test/lib/zendesk/maintenance/jobs/remove_voice_data_participant_job_test.rb                               @getsentry/voice
test/lib/zendesk/maintenance/jobs/revere_synchronization_job_test.rb                                      @getsentry/sunburst
test/lib/zendesk/maintenance/jobs/revoke_external_email_credentials_job_test.rb                           @getsentry/strongbad
test/lib/zendesk/maintenance/jobs/satisfaction_rating_intention_job_test.rb                               @getsentry/fang
test/lib/zendesk/maintenance/jobs/scrub_ticket_requester_job_test.rb                                      @getsentry/argonauts
test/lib/zendesk/maintenance/jobs/security_policy_mailer_job_test.rb                                      @getsentry/secdev
test/lib/zendesk/maintenance/jobs/support_address_status_job_test.rb                                      @getsentry/strongbad
test/lib/zendesk/maintenance/jobs/talk_usage_monitoring_job_test.rb                                       @getsentry/narwhals @getsentry/otters
test/lib/zendesk/maintenance/jobs/thesaurus_reset_job_test.rb                                             @getsentry/boxoffice @getsentry/popcorn
test/lib/zendesk/maintenance/jobs/ticket_deletion_job_test.rb                                             @getsentry/boxoffice @getsentry/popcorn
test/lib/zendesk/maintenance/jobs/trial_expiry_job_test.rb                                                @getsentry/narwhals @getsentry/otters
test/lib/zendesk/maintenance/jobs/unsubscribe_twitter_job_test.rb                                         @getsentry/ocean
test/lib/zendesk/maintenance/jobs/unuploaded_usage_cleanup_job_test.rb                                    @getsentry/narwhals @getsentry/otters
test/lib/zendesk/maintenance/jobs/user_contact_information_job_test.rb                                    @getsentry/bilby
test/lib/zendesk/maintenance/jobs/user_count_job_test.rb                                                  @getsentry/bilby
test/lib/zendesk/maintenance/jobs/voice*                                                                  @getsentry/voice
test/lib/zendesk/maintenance/util/batch_close_test.rb                                                     @getsentry/ticket-platform
test/lib/zendesk/maintenance/util/subdomain_releaser_test.rb                                              @getsentry/account-data-deletion
test/lib/zendesk/messaging_csat/                                                                          @getsentry/teapot @getsentry/tealeaves
test/lib/zendesk/method_call_instrumentation_test.rb                                                      @getsentry/bilby
test/lib/zendesk/ml_triage_client_test.rb                                                                 @getsentry/lynx
test/lib/zendesk/mobile_sdk/                                                                              @getsentry/lir
test/lib/zendesk/model_change_instrumentation_test.rb                                                     @getsentry/rakali
test/lib/zendesk/model_limit_test.rb                                                                      @getsentry/bolt @getsentry/rails-upgrade
test/lib/zendesk/monitor/owner_changer_test.rb                                                            @getsentry/bilby
test/lib/zendesk/offset_pagination_limiter_test.rb                                                        @getsentry/bilby
test/lib/zendesk/organization/escape_publisher_test.rb                                                    @getsentry/kowari
test/lib/zendesk/organization_memberships/finder_test.rb                                                  @getsentry/kowari
test/lib/zendesk/organization_subscriptions/finder_test.rb                                                @getsentry/kowari
test/lib/zendesk/permissions/permission_change_custom_metrics_test.rb                                     @getsentry/firefly
test/lib/zendesk/pid_equalizer_test.rb                                                                    @getsentry/gecko
test/lib/zendesk/push_notifications/gdpr/gdpr_feedback_publisher_test.rb                                  @getsentry/argonauts
test/lib/zendesk/push_notifications/gdpr/gdpr_feedback_subscriber_test.rb                                 @getsentry/spyglass
test/lib/zendesk/push_notifications/gdpr/gdpr_publisher_test.rb                                           @getsentry/argonauts @getsentry/spyglass
test/lib/zendesk/push_notifications/gdpr/gdpr_sns_feedback_publisher_test.rb                              @getsentry/argonauts
test/lib/zendesk/push_notifications/gdpr/gdpr_sns_publisher_test.rb                                       @getsentry/argonauts @getsentry/spyglass
test/lib/zendesk/push_notifications/gdpr/gdpr_sns_user_deletion_publisher_test.rb                         @getsentry/spyglass @getsentry/bilby
test/lib/zendesk/push_notifications/gdpr/gdpr_sqs_feedback_subscriber_test.rb                             @getsentry/spyglass
test/lib/zendesk/push_notifications/gdpr/gdpr_sqs_subscriber_test.rb                                      @getsentry/argonauts @getsentry/spyglass
test/lib/zendesk/push_notifications/gdpr/gdpr_sqs_user_deletion_subscriber_test.rb                        @getsentry/bilby
test/lib/zendesk/push_notifications/gdpr/gdpr_subscriber_test.rb                                          @getsentry/argonauts @getsentry/spyglass
test/lib/zendesk/push_notifications/gdpr/gdpr_user_deletion_publisher_test.rb                             @getsentry/spyglass @getsentry/bilby
test/lib/zendesk/push_notifications/gdpr/gdpr_user_deletion_subscriber_test.rb                            @getsentry/bilby
test/lib/zendesk/record_counter/archive_support_test.rb                                                   @getsentry/boxoffice @getsentry/popcorn
test/lib/zendesk/record_counter/assigned_tickets_test.rb                                                  @getsentry/boxoffice @getsentry/popcorn
test/lib/zendesk/record_counter/audits_test.rb                                                            @getsentry/boxoffice @getsentry/popcorn
test/lib/zendesk/record_counter/base_test.rb                                                              @getsentry/boxoffice @getsentry/popcorn @getsentry/bilby
test/lib/zendesk/record_counter/brands_test.rb                                                            @getsentry/boxoffice @getsentry/popcorn
test/lib/zendesk/record_counter/ccd_tickets_test.rb                                                       @getsentry/strongbad
test/lib/zendesk/record_counter/collaborated_tickets_test.rb                                              @getsentry/strongbad
test/lib/zendesk/record_counter/comments_test.rb                                                          @getsentry/orchid
test/lib/zendesk/record_counter/deleted_tickets_test.rb                                                   @getsentry/boxoffice @getsentry/popcorn
test/lib/zendesk/record_counter/deleted_users_test.rb                                                     @getsentry/bilby
test/lib/zendesk/record_counter/followed_tickets_test.rb                                                  @getsentry/boxoffice @getsentry/popcorn
test/lib/zendesk/record_counter/group_memberships_test.rb                                                 @getsentry/bolt
test/lib/zendesk/record_counter/groups_test.rb                                                            @getsentry/bolt
test/lib/zendesk/record_counter/identities_test.rb                                                        @getsentry/bilby
test/lib/zendesk/record_counter/incidents_test.rb                                                         @getsentry/boxoffice @getsentry/popcorn
test/lib/zendesk/record_counter/macro_groups_test.rb                                                      @getsentry/fang
test/lib/zendesk/record_counter/macros_test.rb                                                            @getsentry/fang
test/lib/zendesk/record_counter/organization_fields_test.rb                                               @getsentry/kowari @getsentry/vinyl
test/lib/zendesk/record_counter/organization_memberships_test.rb                                          @getsentry/bilby @getsentry/kowari
test/lib/zendesk/record_counter/organization_subscriptions_test.rb                                        @getsentry/kowari
test/lib/zendesk/record_counter/organizations_test.rb                                                     @getsentry/kowari
test/lib/zendesk/record_counter/problems_test.rb                                                          @getsentry/boxoffice @getsentry/popcorn
test/lib/zendesk/record_counter/requested_tickets_test.rb                                                 @getsentry/boxoffice @getsentry/popcorn
test/lib/zendesk/record_counter/requests_test.rb                                                          @getsentry/boxoffice @getsentry/popcorn
test/lib/zendesk/record_counter/satisfaction_ratings_test.rb                                              @getsentry/fang
test/lib/zendesk/record_counter/tag_scores_test.rb                                                        @getsentry/boxoffice @getsentry/popcorn
test/lib/zendesk/record_counter/ticket_activities_test.rb                                                 @getsentry/ticket-platform
test/lib/zendesk/record_counter/ticket_fields_test.rb                                                     @getsentry/boxoffice @getsentry/popcorn
test/lib/zendesk/record_counter/ticket_metric_events_test.rb                                              @getsentry/fang
test/lib/zendesk/record_counter/ticket_metric_scores_test.rb                                              @getsentry/fang
test/lib/zendesk/record_counter/tickets_test.rb                                                           @getsentry/boxoffice @getsentry/popcorn
test/lib/zendesk/record_counter/user_fields_test.rb                                                       @getsentry/bilby @getsentry/vinyl
test/lib/zendesk/record_counter/users_pagination_test.rb                                                  @getsentry/classic-core-cph
test/lib/zendesk/record_counter/users_test.rb                                                             @getsentry/bilby
test/lib/zendesk/record_counter/views_test.rb                                                             @getsentry/views-core @getsentry/views-enablement
test/lib/zendesk/redis_client_helper_test.rb                                                              @getsentry/bolt
test/lib/zendesk/remote_files_config/loader_test.rb                                                       @getsentry/strongbad
test/lib/zendesk/reply_parser_instrumentation_test.rb                                                     @getsentry/strongbad
test/lib/zendesk/reports/processor_test.rb                                                                @getsentry/foundation-analytics-stream
test/lib/zendesk/request_origin_details_test.rb                                                           @getsentry/squonk
test/lib/zendesk/requests/finder_test.rb                                                                  @getsentry/boxoffice @getsentry/popcorn
test/lib/zendesk/resource_collection/automation_params_sanitizer_test.rb                                  @getsentry/libretto
test/lib/zendesk/resource_collection/custom_field_params_sanitizer_test.rb                                @getsentry/bilby
test/lib/zendesk/resource_collection/macro_params_sanitizer_test.rb                                       @getsentry/fang
test/lib/zendesk/resource_collection/resource_collection_params_test.rb                                   @getsentry/dingo
test/lib/zendesk/resource_collection/target_params_sanitizer_test.rb                                      @getsentry/vegemite
test/lib/zendesk/resource_collection/ticket_field_params_sanitizer_test.rb                                @getsentry/boxoffice @getsentry/popcorn
test/lib/zendesk/resource_collection/trigger_params_sanitizer_test.rb                                     @getsentry/libretto
test/lib/zendesk/resource_collection/view_params_sanitizer_test.rb                                        @getsentry/views-core @getsentry/views-enablement
test/lib/zendesk/resque_exception_tracking_test.rb                                                        @getsentry/bolt
test/lib/zendesk/resque_query_comments_test.rb                                                            @getsentry/bolt
test/lib/zendesk/routing/                                                                                 @getsentry/argonauts
test/lib/zendesk/routing_validations_test.rb                                                              @getsentry/boxoffice @getsentry/popcorn
test/lib/zendesk/rule_selection/                                                                          @getsentry/fang @getsentry/libretto
test/lib/zendesk/rule_selection/macro_usage_test.rb                                                       @getsentry/fang
test/lib/zendesk/rule_selection_test.rb                                                                   @getsentry/fang @getsentry/libretto
test/lib/zendesk/rules/                                                                                   @getsentry/fang @getsentry/libretto
test/lib/zendesk/rules/automation*                                                                        @getsentry/libretto
test/lib/zendesk/rules/broken_occam_ticket_count_test.rb                                                  @getsentry/views-core  @getsentry/views-enablement
test/lib/zendesk/rules/categories/                                                                        @getsentry/libretto
test/lib/zendesk/rules/condition_test.rb                                                                  @getsentry/views-core @getsentry/views-enablement
test/lib/zendesk/rules/context*.rb                                                                        @getsentry/views-core @getsentry/views-enablement
test/lib/zendesk/rules/controller_support/views_rate_limiter_support_test.rb                              @getsentry/views-core @getsentry/views-enablement
test/lib/zendesk/rules/definition*.rb                                                                     @getsentry/views-core @getsentry/views-enablement
test/lib/zendesk/rules/dehydrated_ticket_test.rb                                                          @getsentry/libretto
test/lib/zendesk/rules/diff_test.rb                                                                       @getsentry/libretto
test/lib/zendesk/rules/execution_options_test.rb                                                          @getsentry/views-core @getsentry/views-enablement
test/lib/zendesk/rules/macro/                                                                             @getsentry/fang
test/lib/zendesk/rules/macro_application_test.rb                                                          @getsentry/fang
test/lib/zendesk/rules/match_test.rb                                                                      @getsentry/libretto
test/lib/zendesk/rules/occam_*.rb                                                                         @getsentry/views-core @getsentry/views-enablement
test/lib/zendesk/rules/position_update_with_categories_test.rb                                            @getsentry/libretto
test/lib/zendesk/rules/relationship_filter_test.rb                                                        @getsentry/vinyl
test/lib/zendesk/rules/rule_executer/count_many_test.rb                                                   @getsentry/views-core @getsentry/views-enablement
test/lib/zendesk/rules/rule_executer_occam_test.rb                                                        @getsentry/views-core @getsentry/views-enablement
test/lib/zendesk/rules/rule_executer_test.rb                                                              @getsentry/views-core @getsentry/views-enablement
test/lib/zendesk/rules/rule_query_builder_test.rb                                                         @getsentry/views-core @getsentry/views-enablement
test/lib/zendesk/rules/slow_rule_report_client_test.rb                                                    @getsentry/views-core @getsentry/views-enablement
test/lib/zendesk/rules/trigger/                                                                           @getsentry/libretto
test/lib/zendesk/rules/trigger_definition_test.rb                                                         @getsentry/libretto
test/lib/zendesk/rules/view/                                                                              @getsentry/views-core @getsentry/views-enablement
test/lib/zendesk/rules/view/view_queue_test.rb                                                            @getsentry/tea-horse
test/lib/zendesk/rules/views_rate_limiter_test.rb                                                         @getsentry/views-core @getsentry/views-enablement
test/lib/zendesk/salesforce/                                                                              @getsentry/platycorn
test/lib/zendesk/sandbox/                                                                                 @getsentry/ngiyari @getsentry/pcc-operations
test/lib/zendesk/satisfaction_ratings/finder_test.rb                                                      @getsentry/fang
test/lib/zendesk/scrub_test.rb                                                                            @getsentry/boxoffice @getsentry/popcorn
test/lib/zendesk/search/                                                                                  @getsentry/search
test/lib/zendesk/search/guide_query_parser_test.rb                                                        @getsentry/guide-search
test/lib/zendesk/search_test.rb                                                                           @getsentry/search
test/lib/zendesk/security_policy/validation_test.rb                                                       @getsentry/secdev
test/lib/zendesk/security_policy_test.rb                                                                  @getsentry/secdev
test/lib/zendesk/sell/internal_api_client_test.rb                                                         @getsentry/sell-core-services
test/lib/zendesk/serialization/collaboration_serialization_test.rb                                        @getsentry/strongbad
test/lib/zendesk/serialization/group_serialization_test.rb                                                @getsentry/bolt @getsentry/bilby
test/lib/zendesk/serialization/organization_serialization_test.rb                                         @getsentry/kowari
test/lib/zendesk/serialization/preview_results_serialization_test.rb                                      @getsentry/views-core @getsentry/views-enablement
test/lib/zendesk/serialization/preview_tickets_serialization_test.rb                                      @getsentry/views-core @getsentry/views-enablement
test/lib/zendesk/serialization/search/                                                                    @getsentry/search
test/lib/zendesk/serialization/sms_notification_serialization_test.rb                                     @getsentry/voice
test/lib/zendesk/serialization/tag_score_serialization_test.rb                                            @getsentry/views-core @getsentry/views-enablement
test/lib/zendesk/serialization/ticket_serialization_test.rb                                               @getsentry/boxoffice @getsentry/popcorn
test/lib/zendesk/serialization/user_identity_serialization_test.rb                                        @getsentry/bilby
test/lib/zendesk/serialization/user_serialization_test.rb                                                 @getsentry/bilby
test/lib/zendesk/session_management_test.rb                                                               @getsentry/secdev
test/lib/zendesk/shard_mover/                                                                             @getsentry/account-data-deletion
test/lib/zendesk/side_conversations/internal_api_client_test.rb                                           @getsentry/collaboration
test/lib/zendesk/simplified_email_threading/                                                              @getsentry/strongbad
test/lib/zendesk/sla/                                                                                     @getsentry/fang
test/lib/zendesk/sla_test.rb                                                                              @getsentry/fang
test/lib/zendesk/slack/render_utils_test.rb                                                               @getsentry/pegasus
test/lib/zendesk/sli_request_tagger_test.rb                                                               @getsentry/views-core @getsentry/views-enablement
test/lib/zendesk/sms/                                                                                     @getsentry/voice
test/lib/zendesk/spp_health_check_test.rb                                                                 @getsentry/bilby
test/lib/zendesk/staff_client_test.rb                                                                     @getsentry/bilby @getsentry/rakali
test/lib/zendesk/stats/active_record_stats_test.rb                                                        @getsentry/ingest
test/lib/zendesk/stats/consul_to_stats_yml_adapter_test.rb                                                @getsentry/foundation-analytics-stream @getsentry/squonk
test/lib/zendesk/stores/                                                                                  @getsentry/squonk
test/lib/zendesk/stores/backfill/                                                                         @getsentry/squonk
test/lib/zendesk/stripped_phone_number_test.rb                                                            @getsentry/kelpie
test/lib/zendesk/suite_trial_test.rb                                                                      @getsentry/rakali
test/lib/zendesk/sunshine/account_config_client_test.rb                                                   @getsentry/echidna
test/lib/zendesk/support_accounts/                                                                        @getsentry/bilby @getsentry/rakali
test/lib/zendesk/support_users/                                                                           @getsentry/bilby @getsentry/rakali
test/lib/zendesk/support_users/entitlement_change_remediation_test.rb                                     @getsentry/rakali
test/lib/zendesk/support_users/entitlement_synchronizer_lock_test.rb                                      @getsentry/rakali
test/lib/zendesk/support_users/internal/role_validator_test.rb                                            @getsentry/bilby @getsentry/rakali
test/lib/zendesk/support_users/support_entitlement_translator_test.rb                                     @getsentry/rakali
test/lib/zendesk/system_user_auth_ip_validation_test.rb                                                   @getsentry/secdev
test/lib/zendesk/targets/                                                                                 @getsentry/vegemite
test/lib/zendesk/ticket_activities/finder_test.rb                                                         @getsentry/ticket-platform
test/lib/zendesk/ticket_anonymizer/                                                                       @getsentry/argonauts
test/lib/zendesk/ticket_field_condition_conversion_test.rb                                                @getsentry/boxoffice @getsentry/popcorn
test/lib/zendesk/ticket_fields/finder_test.rb                                                             @getsentry/boxoffice @getsentry/popcorn
test/lib/zendesk/ticket_forms/                                                                            @getsentry/boxoffice @getsentry/popcorn
test/lib/zendesk/ticket_metric/                                                                           @getsentry/fang
test/lib/zendesk/ticket_metric_test.rb                                                                    @getsentry/fang
test/lib/zendesk/tickets/anonymous/controller_support_test.rb                                             @getsentry/boxoffice @getsentry/popcorn
test/lib/zendesk/tickets/anonymous/initializer_test.rb                                                    @getsentry/boxoffice @getsentry/popcorn
test/lib/zendesk/tickets/archive_finders_test.rb                                                          @getsentry/support-ticket-archiving
test/lib/zendesk/tickets/channels_test.rb                                                                 @getsentry/ocean
test/lib/zendesk/tickets/closed_updates_test.rb                                                           @getsentry/teapot @getsentry/tealeaves @getsentry/ticket-platform
test/lib/zendesk/tickets/collaboration_support_test.rb                                                    @getsentry/strongbad
test/lib/zendesk/tickets/comment_update_test.rb                                                           @getsentry/orchid
test/lib/zendesk/tickets/comments/                                                                        @getsentry/orchid
test/lib/zendesk/tickets/comments/email_comment_support_test.rb                                           @getsentry/strongbad
test/lib/zendesk/tickets/controller_support_test.rb                                                       @getsentry/boxoffice @getsentry/popcorn
test/lib/zendesk/tickets/facebook_test.rb                                                                 @getsentry/ocean
test/lib/zendesk/tickets/finder_test.rb                                                                   @getsentry/boxoffice @getsentry/popcorn
test/lib/zendesk/tickets/importer_test.rb                                                                 @getsentry/boxoffice @getsentry/popcorn
test/lib/zendesk/tickets/initializer_test.rb                                                              @getsentry/boxoffice @getsentry/popcorn
test/lib/zendesk/tickets/merger_test.rb                                                                   @getsentry/boxoffice @getsentry/popcorn
test/lib/zendesk/tickets/metric_sets_pagination_test.rb                                                   @getsentry/fang
test/lib/zendesk/tickets/problem_incident_test.rb                                                         @getsentry/boxoffice @getsentry/popcorn
test/lib/zendesk/tickets/recent_ticket_manager_test.rb                                                    @getsentry/boxoffice @getsentry/popcorn
test/lib/zendesk/tickets/recent_ticket_store_test.rb                                                      @getsentry/boxoffice @getsentry/popcorn
test/lib/zendesk/tickets/recoverer_test.rb                                                                @getsentry/strongbad
test/lib/zendesk/tickets/requester_data_parser_test.rb                                                    @getsentry/boxoffice @getsentry/popcorn
test/lib/zendesk/tickets/safe_update_test.rb                                                              @getsentry/teapot @getsentry/tealeaves
test/lib/zendesk/tickets/set_collaborators_test.rb                                                        @getsentry/strongbad
test/lib/zendesk/tickets/set_collaborators_v2_test.rb                                                     @getsentry/strongbad
test/lib/zendesk/tickets/sms_test.rb                                                                      @getsentry/voice
test/lib/zendesk/tickets/soft_deletion_test.rb                                                            @getsentry/boxoffice @getsentry/popcorn
test/lib/zendesk/tickets/ticket_field_manager_test.rb                                                     @getsentry/boxoffice @getsentry/popcorn
test/lib/zendesk/tickets/ticket_field_options_test.rb                                                     @getsentry/boxoffice @getsentry/popcorn
test/lib/zendesk/tickets/unverified_email_controller_support_test.rb                                      @getsentry/boxoffice @getsentry/popcorn
test/lib/zendesk/tickets/url_builder_test.rb                                                              @getsentry/boxoffice @getsentry/popcorn
test/lib/zendesk/tickets/v2/importer_test.rb                                                              @getsentry/boxoffice @getsentry/popcorn
test/lib/zendesk/tickets/v2/initializer_test.rb                                                           @getsentry/boxoffice @getsentry/popcorn
test/lib/zendesk/trial_activation_state_test.rb                                                           @getsentry/ngiyari @getsentry/pcc-operations
test/lib/zendesk/trial_activation_test.rb                                                                 @getsentry/rakali
test/lib/zendesk/user_portal_state_test.rb                                                                @getsentry/bilby @getsentry/guide-dev
test/lib/zendesk/user_views/                                                                              @getsentry/penguin
test/lib/zendesk/users/                                                                                   @getsentry/bilby
test/lib/zendesk/users/agent_downgrader_test.rb                                                           @getsentry/bilby
test/lib/zendesk/users/finder_test.rb                                                                     @getsentry/bilby
test/lib/zendesk/users/finder_with_pagination_test.rb                                                     @getsentry/bilby
test/lib/zendesk/users/identities/                                                                        @getsentry/bilby
test/lib/zendesk/users/initializer_test.rb                                                                @getsentry/bilby
test/lib/zendesk/users/rate_limiting_test.rb                                                              @getsentry/boxoffice @getsentry/popcorn
test/lib/zendesk/users/security_settings_test.rb                                                          @getsentry/bilby
test/lib/zendesk/users/upsert_initializer_test.rb                                                         @getsentry/bilby
test/lib/zendesk/voice/                                                                                   @getsentry/voice
test/lib/zendesk/voyager_client_builder_test.rb                                                           @getsentry/views-enablement
test/lib/zendesk/webhook/                                                                                 @getsentry/vegemite
test/lib/zendesk/zd_date_time_test.rb                                                                     @getsentry/bolt
test/lib/zendesk/znowflake_http_client_test.rb                                                            @getsentry/bolt
test/lib/zendesk/znowflake_migration_test.rb                                                              @getsentry/bolt
test/lib/zendesk/zrn/catalogue_test.rb                                                                    @getsentry/vinyl
test/lib/zopim/                                                                                           @getsentry/narwhals @getsentry/otters @getsentry/teapot @getsentry/tealeaves
test/mailers/                                                                                             @getsentry/strongbad
test/mailers/deflection_mailer_test.rb                                                                    @getsentry/waratah @getsentry/strongbad
test/mailers/events_mailer_test.rb                                                                        @getsentry/strongbad
test/mailers/old_deflection_mailer_test.rb                                                                @getsentry/waratah @getsentry/strongbad
test/mailers/re_engagement_mailer_test.rb                                                                 @getsentry/woodstock
test/mailers/security_notifications/user_identity_changed_test.rb                                         @getsentry/strongbad @getsentry/bilby
test/mailers/users_mailer_test.rb                                                                         @getsentry/strongbad @getsentry/bilby
test/middleware/account_rate_limit_middleware_test.rb                                                     @getsentry/capacity-planning @getsentry/bolt
test/middleware/api_rate_limited_middleware_test.rb                                                       @getsentry/bolt
test/middleware/billing/                                                                                  @getsentry/narwhals @getsentry/otters
test/middleware/concurrency_limiter_middleware_test.rb                                                    @getsentry/bolt
test/middleware/conditional_rate_limit_middleware_test.rb                                                 @getsentry/bolt
test/middleware/datadog_middleware_test.rb                                                                @getsentry/squonk
test/middleware/exception_tracking_middleware_test.rb                                                     @getsentry/bolt
test/middleware/http_method_not_allowed_middleware_test.rb                                                @getsentry/bolt
test/middleware/invalid_api_request_handler_test.rb                                                       @getsentry/bolt
test/middleware/invalid_params_handler_test.rb                                                            @getsentry/bolt
test/middleware/ip_whitelist_middleware_test.rb                                                           @getsentry/bolt
test/middleware/limiter_middleware_test.rb                                                                @getsentry/bolt
test/middleware/mapped_database_exceptions_middleware_test.rb                                             @getsentry/bolt
test/middleware/middleware_tracing_middleware_test.rb                                                     @getsentry/classic-core-cph
test/middleware/mobile_sdk_api_redirector_test.rb                                                         @getsentry/lir
test/middleware/rule_routing_middleware_test.rb                                                           @getsentry/fang @getsentry/views-core @getsentry/views-enablement @getsentry/libretto
test/middleware/system_instrumentation_middleware_test.rb                                                 @getsentry/bolt
test/middleware/web_portal_redirect_middleware_test.rb                                                    @getsentry/classic-core-cph
test/models/access/                                                                                       @getsentry/bilby @getsentry/firefly
test/models/access/external_permissions/                                                                  @getsentry/firefly
test/models/access/permissions/                                                                           @getsentry/firefly
test/models/access/permissions/organization_membership_permission_test.rb                                 @getsentry/firefly @getsentry/kowari
test/models/access/permissions/user_permission_test.rb                                                    @getsentry/bilby @getsentry/firefly @getsentry/bolt
test/models/access/policies/attachment_policy_test.rb                                                     @getsentry/squonk
test/models/access/policies/organization_membership_policy_test.rb                                        @getsentry/firefly @getsentry/kowari
test/models/access/policies/rule_policy_test.rb                                                           @getsentry/fang @getsentry/libretto
test/models/access/validations/ticket_validator_test.rb                                                   @getsentry/boxoffice @getsentry/popcorn
test/models/account/account_mail_test.rb                                                                  @getsentry/strongbad
test/models/account/active_triggers_caching_test.rb                                                       @getsentry/libretto
test/models/account/agent_workspace_support_test.rb                                                       @getsentry/iris
test/models/account/billable_agents_test.rb                                                               @getsentry/narwhals @getsentry/otters
test/models/account/canceller_test.rb                                                                     @getsentry/belugas
test/models/account/capability/polaris_compatible_test.rb                                                 @getsentry/iris
test/models/account/chat_support_test.rb                                                                  @getsentry/bilby
test/models/account/creation_test.rb                                                                      @getsentry/bilby
test/models/account/crm_integration_test.rb                                                               @getsentry/platycorn
test/models/account/custom_statuses_test.rb                                                               @getsentry/boxoffice @getsentry/popcorn
test/models/account/customer_satisfaction_support_test.rb                                                 @getsentry/fang
test/models/account/explore_support_test.rb                                                               @getsentry/kepler
test/models/account/fraud_support_test.rb                                                                 @getsentry/orca
test/models/account/malware_whitelist_test.rb                                                             @getsentry/strongbad
test/models/account/multiproduct_billable_agents_test.rb                                                  @getsentry/lyrebird
test/models/account/multiproduct_support_test.rb                                                          @getsentry/narwhals @getsentry/otters
test/models/account/onboarding_support_test.rb                                                            @getsentry/ponderosa
test/models/account/route_support_test.rb                                                                 @getsentry/boxoffice @getsentry/popcorn
test/models/account/sandbox_support_test.rb                                                               @getsentry/ngiyari @getsentry/pcc-operations
test/models/account/security_feature_support_test.rb                                                      @getsentry/secdev
test/models/account/side_conversations_support_test.rb                                                    @getsentry/collaboration
test/models/account/spam_sensitivity_test.rb                                                              @getsentry/strongbad @getsentry/orca
test/models/account/suite_support_test.rb                                                                 @getsentry/narwhals @getsentry/otters
test/models/account/suspension_test.rb                                                                    @getsentry/narwhals @getsentry/otters
test/models/account/ticket_field_caching_test.rb                                                          @getsentry/boxoffice @getsentry/popcorn
test/models/account/web_widget_support_test.rb                                                            @getsentry/copperhead
test/models/account_move_test.rb                                                                          @getsentry/exodus @getsentry/sunburst
test/models/account_service_subscription_test.rb                                                          @getsentry/narwhals @getsentry/otters
test/models/accounts/                                                                                     @getsentry/bilby
test/models/accounts/sandbox_test.rb                                                                      @getsentry/ngiyari @getsentry/pcc-operations
test/models/acme_authorization_test.rb                                                                    @getsentry/secdev
test/models/acme_certificate_job_status_test.rb                                                           @getsentry/secdev
test/models/acme_certificate_test.rb                                                                      @getsentry/secdev
test/models/acme_registration_test.rb                                                                     @getsentry/secdev
test/models/agent_downgrade_audit_test.rb                                                                 @getsentry/narwhals @getsentry/otters
test/models/answer_bot/                                                                                   @getsentry/waratah
test/models/apps/chat_app_installation_test.rb                                                            @getsentry/iris
test/models/attachment_test.rb                                                                            @getsentry/squonk
test/models/brand/help_center_support_test.rb                                                             @getsentry/guide-dev
test/models/brand_test.rb                                                                                 @getsentry/boxoffice @getsentry/popcorn
test/models/certificate_authorities_test.rb                                                               @getsentry/secdev
test/models/certificate_ip_test.rb                                                                        @getsentry/secdev
test/models/certificate_test.rb                                                                           @getsentry/secdev
test/models/chat_transcript/                                                                              @getsentry/teapot @getsentry/tealeaves
test/models/chat_transcript_test.rb                                                                       @getsentry/teapot @getsentry/tealeaves
test/models/cms/text_test.rb                                                                              @getsentry/athene
test/models/cms/variant_test.rb                                                                           @getsentry/athene
test/models/collaboration/                                                                                @getsentry/strongbad
test/models/collaboration_test.rb                                                                         @getsentry/strongbad
test/models/compliance_deletion_feedback_test.rb                                                          @getsentry/spyglass
test/models/compliance_deletion_status_test.rb                                                            @getsentry/spyglass
test/models/concerns/chat_phase_three_test.rb                                                             @getsentry/bolt
test/models/concerns/field_creation_statsd_metrics_test.rb                                                @getsentry/vinyl
test/models/concerns/lookup_field_source_test.rb                                                          @getsentry/vinyl
test/models/concerns/raw_http_test.rb                                                                     @getsentry/vegemite
test/models/concerns/relationship_field_validation_test.rb                                                @getsentry/vinyl
test/models/concerns/relationship_field_value_validation_test.rb                                          @getsentry/vinyl
test/models/concerns/tde_workspace_test.rb                                                                @getsentry/kingfisher
test/models/concerns/trial_limit_test.rb                                                                  @getsentry/space-dogs
test/models/credit_card_test.rb                                                                           @getsentry/narwhals @getsentry/otters
test/models/custom_field/                                                                                 @getsentry/boxoffice @getsentry/popcorn @getsentry/vinyl
test/models/custom_field/dropdown_choice/attribute_change_creator_test.rb                                 @getsentry/kowari @getsentry/vinyl
test/models/custom_field_option_test.rb                                                                   @getsentry/boxoffice @getsentry/popcorn @getsentry/vinyl
test/models/custom_object_record_test.rb                                                                  @getsentry/vinyl
test/models/custom_object_test.rb                                                                         @getsentry/vinyl
test/models/custom_object_value_test.rb                                                                   @getsentry/vinyl
test/models/custom_security_policy_test.rb                                                                @getsentry/secdev
test/models/custom_status_test.rb                                                                         @getsentry/boxoffice @getsentry/popcorn
test/models/data_deletion_audit_job_test.rb                                                               @getsentry/account-data-deletion
test/models/data_deletion_audit_test.rb                                                                   @getsentry/account-data-deletion
test/models/email_fb_integration_test.rb                                                                  @getsentry/strongbad
test/models/esc_kafka_message_test.rb                                                                     @getsentry/ticket-platform @getsentry/goanna
test/models/events/answer_bot_notification_test.rb                                                        @getsentry/waratah
test/models/events/associate_att_vals_event_test.rb                                                       @getsentry/argonauts
test/models/events/audit_test.rb                                                                          @getsentry/fang @getsentry/libretto
test/models/events/automatic_answer_reject_test.rb                                                        @getsentry/waratah
test/models/events/automatic_answer_send_test.rb                                                          @getsentry/waratah
test/models/events/automatic_answer_solve_test.rb                                                         @getsentry/waratah
test/models/events/automatic_answer_viewed_test.rb                                                        @getsentry/waratah
test/models/events/cc_test.rb                                                                             @getsentry/strongbad
test/models/events/change_test.rb                                                                         @getsentry/ticket-platform
test/models/events/channel_back_event_test.rb                                                             @getsentry/ocean
test/models/events/channel_back_failed_event_test.rb                                                      @getsentry/ocean
test/models/events/chat_ended_event_test.rb                                                               @getsentry/teapot @getsentry/tealeaves
test/models/events/chat_event_test.rb                                                                     @getsentry/teapot @getsentry/tealeaves
test/models/events/chat_file_redaction_event_test.rb                                                      @getsentry/orchid
test/models/events/chat_message_redact_event_test.rb                                                      @getsentry/orchid
test/models/events/chat_started_event_test.rb                                                             @getsentry/teapot @getsentry/tealeaves
test/models/events/collab_thread_closed_test.rb                                                           @getsentry/collaboration
test/models/events/collab_thread_created_test.rb                                                          @getsentry/collaboration
test/models/events/collab_thread_event_test.rb                                                            @getsentry/collaboration
test/models/events/collab_thread_reopened_test.rb                                                         @getsentry/collaboration
test/models/events/collab_thread_reply_test.rb                                                            @getsentry/collaboration
test/models/events/collab_thread_via_trigger_test.rb                                                      @getsentry/collaboration
test/models/events/collaboration_change_test.rb                                                           @getsentry/strongbad
test/models/events/comment_test.rb                                                                        @getsentry/ticket-platform
test/models/events/create_test.rb                                                                         @getsentry/ticket-platform
test/models/events/email_cc_change_test.rb                                                                @getsentry/strongbad
test/models/events/event_test.rb                                                                          @getsentry/ticket-platform
test/models/events/external_test.rb                                                                       @getsentry/vegemite
test/models/events/facebook_comment_test.rb                                                               @getsentry/ocean
test/models/events/follower_change_test.rb                                                                @getsentry/strongbad
test/models/events/follower_notification_test.rb                                                          @getsentry/strongbad
test/models/events/knowledge_captured_test.rb                                                             @getsentry/waratah
test/models/events/knowledge_flagged_test.rb                                                              @getsentry/waratah
test/models/events/knowledge_link_accepted_test.rb                                                        @getsentry/waratah
test/models/events/knowledge_link_rejected_test.rb                                                        @getsentry/waratah
test/models/events/knowledge_linked_test.rb                                                               @getsentry/waratah
test/models/events/macro_reference_test.rb                                                                @getsentry/fang
test/models/events/messaging_csat_event_test.rb                                                           @getsentry/teapot @getsentry/tealeaves
test/models/events/messaging_event_test.rb                                                                @getsentry/snoop
test/models/events/notification_with_ccs_test.rb                                                          @getsentry/strongbad
test/models/events/re_engagement_sent_test.rb                                                             @getsentry/woodstock
test/models/events/schedule_assignment_test.rb                                                            @getsentry/fang
test/models/events/sla_target_change_test.rb                                                              @getsentry/fang
test/models/events/slack_event_test.rb                                                                    @getsentry/pegasus
test/models/events/sms_notification_test.rb                                                               @getsentry/voice
test/models/events/suspended_ticket_recovery_test.rb                                                      @getsentry/strongbad
test/models/events/ticket_notifier_test.rb                                                                @getsentry/strongbad
test/models/events/ticket_sharing_event_test.rb                                                           @getsentry/boxoffice @getsentry/popcorn
test/models/events/ticket_unshare_event_test.rb                                                           @getsentry/boxoffice @getsentry/popcorn
test/models/events/twitter_dm_event_test.rb                                                               @getsentry/ocean
test/models/events/twitter_event_test.rb                                                                  @getsentry/ocean
test/models/events/user_custom_field_event_test.rb                                                        @getsentry/bilby @getsentry/vinyl @getsentry/libretto
test/models/events/voice_comment_test.rb                                                                  @getsentry/voice
test/models/events/webhook_event_test.rb                                                                  @getsentry/vegemite
test/models/events/workspace_changed_test.rb                                                              @getsentry/kingfisher
test/models/expirable_attachment_test.rb                                                                  @getsentry/squonk
test/models/explore/subscription_test.rb                                                                  @getsentry/narwhals @getsentry/otters
test/models/external_email_credential_test.rb                                                             @getsentry/strongbad
test/models/external_ticket_datas/salesforce_ticket_data_test.rb                                          @getsentry/platycorn
test/models/external_user_datas/                                                                          @getsentry/platycorn @getsentry/bilby
test/models/fraud_score_test.rb                                                                           @getsentry/orca
test/models/group/settings_test.rb                                                                        @getsentry/bolt @getsentry/teapot @getsentry/tealeaves
test/models/group_macro_test.rb                                                                           @getsentry/fang
test/models/group_test.rb                                                                                 @getsentry/bolt @getsentry/teapot @getsentry/tealeaves
test/models/group_view_test.rb                                                                            @getsentry/fang
test/models/guide/                                                                                        @getsentry/guide-dev
test/models/guide/subscription*.rb                                                                        @getsentry/narwhals @getsentry/otters
test/models/guide/subscription/                                                                           @getsentry/narwhals @getsentry/otters
test/models/health/diagnostic/account_fraud_service_diagnostic_test.rb                                    @getsentry/orca
test/models/health/diagnostic/deco_diagnostic_test.rb                                                     @getsentry/argonauts
test/models/health/diagnostic/search_diagnostic_test.rb                                                   @getsentry/search
test/models/health/diagnostic/staff_service_diagnostic_test.rb                                            @getsentry/space-dogs
test/models/health/diagnostic/tessa_diagnostic_test.rb                                                    @getsentry/harrier
test/models/health/diagnostic/voyager_diagnostic_test.rb                                                  @getsentry/views-enablement
test/models/health/diagnostic/zendesk_archive_riak_kv_diagnostic_test.rb                                  @getsentry/ticket-platform
test/models/help_center_state_changer_test.rb                                                             @getsentry/guide-dev
test/models/help_center_test.rb                                                                           @getsentry/guide-dev
test/models/inbound_email_test.rb                                                                         @getsentry/strongbad
test/models/inbound_mail_rate_limit_test.rb                                                               @getsentry/strongbad
test/models/instance_value_test.rb                                                                        @getsentry/argonauts
test/models/jetpack_task_list_test.rb                                                                     @getsentry/ponderosa
test/models/jetpack_task_test.rb                                                                          @getsentry/ponderosa
test/models/jira_issue_test.rb                                                                            @getsentry/pegasus
test/models/jobs/account_agent_workspace_auto_activation_job_test.rb                                      @getsentry/iris
test/models/jobs/account_automation_parallel_execution_job_test.rb                                        @getsentry/libretto
test/models/jobs/account_automations_job_test.rb                                                          @getsentry/libretto
test/models/jobs/account_cancellation_job_test.rb                                                         @getsentry/belugas
test/models/jobs/account_product_feature_sync_job_test.rb                                                 @getsentry/collaboration
test/models/jobs/account_synchronizer_job_test.rb                                                         @getsentry/narwhals @getsentry/otters
test/models/jobs/acme_certificate_job_test.rb                                                             @getsentry/secdev
test/models/jobs/add_all_agents_to_default_group_job_test.rb                                              @getsentry/bolt
test/models/jobs/agent_workspace_activation_job_test.rb                                                   @getsentry/snoop
test/models/jobs/align_user_time_zones_job_test.rb                                                        @getsentry/bilby
test/models/jobs/answer_bot/                                                                              @getsentry/waratah
test/models/jobs/answer_bot/ticket_deflection_tagging_job_test.rb                                         @getsentry/waratah
test/models/jobs/apply_macros_job_test.rb                                                                 @getsentry/fang
test/models/jobs/archive/                                                                                 @getsentry/ticket-platform
test/models/jobs/audit_logs_export_job_test.rb                                                            @getsentry/audit-log
test/models/jobs/billing_related_user_data_job_test.rb                                                    @getsentry/narwhals @getsentry/otters
test/models/jobs/ccs_and_followers/                                                                       @getsentry/strongbad
test/models/jobs/chat_phase_three/entitlement_sync_job_test.rb                                            @getsentry/space-dogs
test/models/jobs/chat_store_redaction_job_test.rb                                                         @getsentry/teapot @getsentry/tealeaves
test/models/jobs/crm_data_bulk_delete_job_test.rb                                                         @getsentry/platycorn
test/models/jobs/custom_field_deletion_job_test.rb                                                        @getsentry/vinyl
test/models/jobs/downcase_subdomains_job_test.rb                                                          @getsentry/quoll
test/models/jobs/downgrade_agent_groups_access_job_test.rb                                                @getsentry/bolt @getsentry/bilby
test/models/jobs/downgrade_organizations_access_job_test.rb                                               @getsentry/bilby @getsentry/kowari
test/models/jobs/dynamo_db_manual_migration_job_test.rb                                                   @getsentry/ticket-platform
test/models/jobs/fraud_score_job_test.rb                                                                  @getsentry/orca
test/models/jobs/group_delete_job_test.rb                                                                 @getsentry/bolt
test/models/jobs/group_membership_bulk_create_job_test.rb                                                 @getsentry/bolt
test/models/jobs/group_membership_bulk_delete_job_test.rb                                                 @getsentry/bolt
test/models/jobs/import/users_job_test.rb                                                                 @getsentry/bilby
test/models/jobs/job_with_status_test.rb                                                                  @getsentry/bolt
test/models/jobs/locale_bulk_update_job_test.rb                                                           @getsentry/bilby @getsentry/boxoffice @getsentry/popcorn
test/models/jobs/mail_rendering_job_test.rb                                                               @getsentry/strongbad
test/models/jobs/malware_scan_consumer_retry_job_test.rb                                                  @getsentry/spyglass
test/models/jobs/messaging_csat_request_job_test.rb                                                       @getsentry/teapot @getsentry/tealeaves
test/models/jobs/omnichannel/                                                                             @getsentry/bilby @getsentry/rakali
test/models/jobs/organization_batch_update_job_test.rb                                                    @getsentry/kowari
test/models/jobs/organization_bulk_create_job_test.rb                                                     @getsentry/kowari
test/models/jobs/organization_bulk_create_job_v3_test.rb                                                  @getsentry/kowari @getsentry/bolt
test/models/jobs/organization_bulk_delete_job_test.rb                                                     @getsentry/kowari
test/models/jobs/organization_bulk_update_job_test.rb                                                     @getsentry/kowari
test/models/jobs/organization_membership_bulk_create_job_test.rb                                          @getsentry/kowari
test/models/jobs/organization_membership_bulk_delete_job_test.rb                                          @getsentry/kowari
test/models/jobs/organization_reassign_job_test.rb                                                        @getsentry/kowari
test/models/jobs/organization_reassign_v2_job_test.rb                                                     @getsentry/kowari
test/models/jobs/organization_unset_job_test.rb                                                           @getsentry/kowari
test/models/jobs/permissions_policy_sync_job_test.rb                                                      @getsentry/space-dogs
test/models/jobs/push_notification*                                                                       @getsentry/lir
test/models/jobs/re_encrypt_external_email_credential_job_test.rb                                         @getsentry/strongbad
test/models/jobs/re_encrypt_target_credentials_job_test.rb                                                @getsentry/vegemite
test/models/jobs/record_counter_job_test.rb                                                               @getsentry/boxoffice @getsentry/popcorn @getsentry/bilby
test/models/jobs/recover_false_positive_suspended_ticket_job_test.rb                                      @getsentry/orca
test/models/jobs/redaction/email_redaction_job_test.rb                                                    @getsentry/orchid
test/models/jobs/remove_regular_organization_memberships_job_test.rb                                      @getsentry/bilby @getsentry/kowari
test/models/jobs/reset_end_users_locale_job_test.rb                                                       @getsentry/bilby
test/models/jobs/restore_default_content_job_test.rb                                                      @getsentry/i18n
test/models/jobs/revere_account_update_job_test.rb                                                        @getsentry/sunburst
test/models/jobs/revere_subscriber_update_job_test.rb                                                     @getsentry/sunburst
test/models/jobs/revoke_external_email_credential_job_test.rb                                             @getsentry/strongbad
test/models/jobs/routing_attribute_value_delete_job_test.rb                                               @getsentry/argonauts
test/models/jobs/rspamd_feedback_job_test.rb                                                              @getsentry/strongbad
test/models/jobs/rule_ticket_count_job_test.rb                                                            @getsentry/views-core @getsentry/views-enablement
test/models/jobs/salesforce_*                                                                             @getsentry/platycorn
test/models/jobs/sandbox_initializer_job_test.rb                                                          @getsentry/ngiyari @getsentry/pcc-operations
test/models/jobs/set_agent_workspace_availability_job_test.rb                                             @getsentry/teapot @getsentry/tealeaves
test/models/jobs/set_user_locale_job_test.rb                                                              @getsentry/lir
test/models/jobs/shared_ticket_bulk_delete_job_test.rb                                                    @getsentry/boxoffice @getsentry/popcorn
test/models/jobs/shell_owner_welcome_email_job_test.rb                                                    @getsentry/space-dogs
test/models/jobs/side_conversation_job_test.rb                                                            @getsentry/collaboration
test/models/jobs/simplified_email_threading/                                                              @getsentry/strongbad
test/models/jobs/sla_badge_fixer_on_ticket_close_job_test.rb                                              @getsentry/fang
test/models/jobs/slack_job_test.rb                                                                        @getsentry/pegasus
test/models/jobs/sms/                                                                                     @getsentry/voice
test/models/jobs/spam_cleanup_job_test.rb                                                                 @getsentry/orca
test/models/jobs/stores_synchronization_job_test.rb                                                       @getsentry/squonk
test/models/jobs/suite_trial_job_test.rb                                                                  @getsentry/rakali
test/models/jobs/support_creation_job_test.rb                                                             @getsentry/rakali
test/models/jobs/support_product_creation_job_test.rb                                                     @getsentry/bilby
test/models/jobs/survey_persistence_job_test.rb                                                           @getsentry/belugas
test/models/jobs/suspended_tickets_bulk_recovery_job_test.rb                                              @getsentry/strongbad
test/models/jobs/sync_chat_agent_avatar_job_test.rb                                                       @getsentry/polo
test/models/jobs/tag_bulk_update_job_test.rb                                                              @getsentry/boxoffice @getsentry/popcorn
test/models/jobs/target_job_test.rb                                                                       @getsentry/vegemite
test/models/jobs/terminate_all_sessions_job_test.rb                                                       @getsentry/secdev
test/models/jobs/ticket_attribute_values_setter_job_test.rb                                               @getsentry/argonauts
test/models/jobs/ticket_batch_update_job_test.rb                                                          @getsentry/boxoffice @getsentry/popcorn
test/models/jobs/ticket_brand_reassign_job_test.rb                                                        @getsentry/boxoffice @getsentry/popcorn
test/models/jobs/ticket_bulk_create_job_test.rb                                                           @getsentry/boxoffice @getsentry/popcorn
test/models/jobs/ticket_bulk_import_job_test.rb                                                           @getsentry/boxoffice @getsentry/popcorn
test/models/jobs/ticket_bulk_update_job_test.rb                                                           @getsentry/boxoffice @getsentry/popcorn
test/models/jobs/ticket_deflection_job_test.rb                                                            @getsentry/waratah
test/models/jobs/ticket_metric_breach_check_job_test.rb                                                   @getsentry/fang
test/models/jobs/ticket_sharing_support_addresses_job_test.rb                                             @getsentry/boxoffice @getsentry/popcorn
test/models/jobs/trigger_cleanup_job_test.rb                                                              @getsentry/libretto
test/models/jobs/update_group_privacy_in_tickets_job_test.rb                                              @getsentry/boxoffice @getsentry/popcorn
test/models/jobs/update_help_center_state_job_test.rb                                                     @getsentry/guide-dev
test/models/jobs/user_batch_update_job_test.rb                                                            @getsentry/bilby
test/models/jobs/user_bulk_create_job_test.rb                                                             @getsentry/bilby
test/models/jobs/user_bulk_create_job_v3_test.rb                                                          @getsentry/bilby @getsentry/bolt
test/models/jobs/user_bulk_delete_job_test.rb                                                             @getsentry/bilby
test/models/jobs/user_bulk_update_job_test.rb                                                             @getsentry/bilby
test/models/jobs/user_bulk_update_job_v2_test.rb                                                          @getsentry/bilby
test/models/jobs/user_entity_account_move_job_test.rb                                                     @getsentry/piratos
test/models/jobs/user_entity_sync_job_test.rb                                                             @getsentry/piratos
test/models/jobs/user_merge_job_test.rb                                                                   @getsentry/bilby
test/models/jobs/user_view_csv_job_test.rb                                                                @getsentry/penguin
test/models/jobs/user_xml_export_job_test.rb                                                              @getsentry/bilby
test/models/jobs/view_csv_job_test.rb                                                                     @getsentry/views-enablement
test/models/jobs/voice/                                                                                   @getsentry/voice
test/models/jobs/voice/usage_subscription_corrector_job_test.rb                                           @getsentry/narwhals @getsentry/otters
test/models/jobs/webhook_job_test.rb                                                                      @getsentry/vegemite
test/models/lotus/                                                                                        @getsentry/harrier
test/models/membership_test.rb                                                                            @getsentry/bolt @getsentry/bilby
test/models/metric_event_policy_metric_test.rb                                                            @getsentry/fang
test/models/mobile_sdk*                                                                                   @getsentry/lir
test/models/nil_subscription_test.rb                                                                      @getsentry/bilby
test/models/ola/                                                                                          @getsentry/fang
test/models/organization/                                                                                 @getsentry/kowari
test/models/organization_association_addition_test.rb                                                     @getsentry/kowari
test/models/organization_association_addition_v2_test.rb                                                  @getsentry/kowari
test/models/organization_association_removal_test.rb                                                      @getsentry/kowari
test/models/organization_domain_test.rb                                                                   @getsentry/kowari
test/models/organization_email_test.rb                                                                    @getsentry/kowari
test/models/organization_membership_test.rb                                                               @getsentry/kowari
test/models/organization_test.rb                                                                          @getsentry/kowari
test/models/outbound/                                                                                     @getsentry/narwhals @getsentry/otters
test/models/outbound_email_recipient_test.rb                                                              @getsentry/strongbad
test/models/outbound_email_test.rb                                                                        @getsentry/strongbad
test/models/permission_set/                                                                               @getsentry/space-dogs @getsentry/firefly
test/models/permission_set_test.rb                                                                        @getsentry/space-dogs @getsentry/firefly
test/models/push_notifications/                                                                           @getsentry/lir
test/models/queue_audit_test.rb                                                                           @getsentry/bolt
test/models/recipient_address_test.rb                                                                     @getsentry/strongbad
test/models/redaction/                                                                                    @getsentry/orchid
test/models/relationship_field_index_test.rb                                                              @getsentry/vinyl
test/models/remote_authentication_test.rb                                                                 @getsentry/unagi
test/models/reviewed_tweet_test.rb                                                                        @getsentry/ocean
test/models/route_test.rb                                                                                 @getsentry/boxoffice @getsentry/popcorn
test/models/routing/                                                                                      @getsentry/argonauts
test/models/rules/                                                                                        @getsentry/fang @getsentry/libretto
test/models/rules/automation_test.rb                                                                      @getsentry/libretto
test/models/rules/cached_rule_preview_ticket_count_test.rb                                                @getsentry/views-core @getsentry/views-enablement
test/models/rules/cached_rule_ticket_count_test.rb                                                        @getsentry/views-core @getsentry/views-enablement
test/models/rules/rule_category_test.rb                                                                   @getsentry/libretto
test/models/rules/rule_test.rb                                                                            @getsentry/fang @getsentry/views-core @getsentry/views-enablement @getsentry/libretto
test/models/rules/trigger*                                                                                @getsentry/libretto
test/models/rules/user_view_test.rb                                                                       @getsentry/penguin
test/models/salesforce_integration_test.rb                                                                @getsentry/platycorn
test/models/satisfaction/cached_score_test.rb                                                             @getsentry/fang
test/models/satisfaction/calculations_test.rb                                                             @getsentry/fang
test/models/satisfaction/prediction_survey_test.rb                                                        @getsentry/fang
test/models/satisfaction/rating_test.rb                                                                   @getsentry/fang
test/models/satisfaction/reason_test.rb                                                                   @getsentry/fang
test/models/satisfaction_rating_intention_test.rb                                                         @getsentry/fang
test/models/sequences/nice_id_sequence_test.rb                                                            @getsentry/ticket-platform
test/models/sequences/sequence_test.rb                                                                    @getsentry/ticket-platform
test/models/sharded_subscription_test.rb                                                                  @getsentry/narwhals @getsentry/otters
test/models/shared_ticket_test.rb                                                                         @getsentry/boxoffice @getsentry/popcorn
test/models/sharing/                                                                                      @getsentry/boxoffice @getsentry/popcorn
test/models/simplified_email_opt_in_setting_test.rb                                                       @getsentry/strongbad
test/models/simplified_email_rule_body_test.rb                                                            @getsentry/strongbad
test/models/skip_test.rb                                                                                  @getsentry/argonauts
test/models/sla/                                                                                          @getsentry/fang
test/models/stores_backfill_audit_test.rb                                                                 @getsentry/squonk
test/models/subscription/delegated_features_test.rb                                                       @getsentry/narwhals @getsentry/otters
test/models/subscription_feature_addon_test.rb                                                            @getsentry/narwhals @getsentry/otters
test/models/subscription_test.rb                                                                          @getsentry/narwhals @getsentry/otters
test/models/suspended_ticket_notification_test.rb                                                         @getsentry/strongbad
test/models/suspended_ticket_test.rb                                                                      @getsentry/strongbad
test/models/targets/                                                                                      @getsentry/vegemite
test/models/targets/email_target_test.rb                                                                  @getsentry/strongbad
test/models/targets/salesforce_target_test.rb                                                             @getsentry/platycorn
test/models/targets/twilio_target_test.rb                                                                 @getsentry/platycorn
test/models/ticket/                                                                                       @getsentry/boxoffice @getsentry/popcorn
test/models/ticket/archive_test.rb                                                                        @getsentry/ticket-platform
test/models/ticket/collaborating_test.rb                                                                  @getsentry/strongbad
test/models/ticket/custom_status_synchronization_test.rb                                                  @getsentry/boxoffice @getsentry/popcorn
test/models/ticket/id_masking_test.rb                                                                     @getsentry/strongbad
test/models/ticket/observers/chat_ticket_observer_test.rb                                                 @getsentry/teapot @getsentry/tealeaves
test/models/ticket/observers/sdk_ticket_activity_observer_test.rb                                         @getsentry/lir
test/models/ticket/observers/ticket_event_bus_observer_test.rb                                            @getsentry/ticket-platform
test/models/ticket/observers/ticket_metrics_observer_test.rb                                              @getsentry/fang
test/models/ticket/observers/ticket_sla_observer_test.rb                                                  @getsentry/fang
test/models/ticket/remote_files_test.rb                                                                   @getsentry/strongbad
test/models/ticket_archive_disqualification_test.rb                                                       @getsentry/support-ticket-archiving
test/models/ticket_archive_stub_test.rb                                                                   @getsentry/support-ticket-archiving
test/models/ticket_deflection_article_test.rb                                                             @getsentry/waratah
test/models/ticket_deflection_test.rb                                                                     @getsentry/waratah
test/models/ticket_field_condition_test.rb                                                                @getsentry/boxoffice @getsentry/popcorn
test/models/ticket_fields/                                                                                @getsentry/boxoffice @getsentry/popcorn @getsentry/vinyl
test/models/ticket_form/                                                                                  @getsentry/boxoffice @getsentry/popcorn
test/models/ticket_form_brand_restriction_test.rb                                                         @getsentry/boxoffice @getsentry/popcorn
test/models/ticket_form_test.rb                                                                           @getsentry/boxoffice @getsentry/popcorn
test/models/ticket_metric/                                                                                @getsentry/fang
test/models/ticket_schedule_test.rb                                                                       @getsentry/fang
test/models/ticket_test.rb                                                                                @getsentry/boxoffice @getsentry/popcorn
test/models/ticket_workspace_test.rb                                                                      @getsentry/kingfisher
test/models/tokens/                                                                                       @getsentry/secdev
test/models/tpe/subscription_test.rb                                                                      @getsentry/narwhals @getsentry/otters
test/models/unverified_ticket_creation_test.rb                                                            @getsentry/boxoffice @getsentry/popcorn
test/models/user_any_channel_identity_test.rb                                                             @getsentry/ocean @getsentry/bilby
test/models/user_contact_information_test.rb                                                              @getsentry/bilby
test/models/user_email_identity_test.rb                                                                   @getsentry/strongbad @getsentry/bilby
test/models/user_foreign_identity_test.rb                                                                 @getsentry/bilby
test/models/user_identity_test.rb                                                                         @getsentry/bilby
test/models/user_messaging_identity_test.rb                                                               @getsentry/teapot
test/models/user_phone_attribute_test.rb                                                                  @getsentry/voice @getsentry/bilby
test/models/user_phone_number_identity_test.rb                                                            @getsentry/bilby
test/models/user_sdk_identity_test.rb                                                                     @getsentry/lir @getsentry/bilby
test/models/user_seat_test.rb                                                                             @getsentry/bilby @getsentry/voice
test/models/user_test.rb                                                                                  @getsentry/bilby
test/models/user_twitter_identity_test.rb                                                                 @getsentry/bilby
test/models/user_voice_forwarding_identity_test.rb                                                        @getsentry/bilby
test/models/users/                                                                                        @getsentry/bilby
test/models/users/access_test.rb                                                                          @getsentry/bilby
test/models/users/answer_bot_test.rb                                                                      @getsentry/answer-bot @getsentry/bilby
test/models/users/authentication_test.rb                                                                  @getsentry/secdev @getsentry/bilby @getsentry/unagi
test/models/users/chat_agent_support_test.rb                                                              @getsentry/bilby
test/models/users/chat_support_test.rb                                                                    @getsentry/bilby
test/models/users/group_memberships_test.rb                                                               @getsentry/bolt
test/models/users/identification_test.rb                                                                  @getsentry/bilby
test/models/users/localization_test.rb                                                                    @getsentry/bilby @getsentry/i18n
test/models/users/merge_test.rb                                                                           @getsentry/bilby
test/models/users/observers/                                                                              @getsentry/bilby
test/models/users/observers/organization_membership_observer_test.rb                                      @getsentry/argonauts @getsentry/bilby @getsentry/kowari
test/models/users/observers/user_entity_observer_test.rb                                                  @getsentry/piratos @getsentry/bilby
test/models/users/onboarding_support_test.rb                                                              @getsentry/ponderosa @getsentry/bilby
test/models/users/organization_memberships_test.rb                                                        @getsentry/bilby
test/models/users/other_product_entitlements_test.rb                                                      @getsentry/bilby
test/models/users/password_test.rb                                                                        @getsentry/secdev @getsentry/bilby
test/models/users/phone_number_behavior_test.rb                                                           @getsentry/voice @getsentry/bilby
test/models/users/phone_number_test.rb                                                                    @getsentry/voice @getsentry/bilby
test/models/users/phone_number_validator_test.rb                                                          @getsentry/voice @getsentry/bilby
test/models/users/photo_test.rb                                                                           @getsentry/bilby
test/models/users/properties_test.rb                                                                      @getsentry/bilby
test/models/users/roles_test.rb                                                                           @getsentry/space-dogs @getsentry/firefly
test/models/users/signature_test.rb                                                                       @getsentry/bilby
test/models/users/suite_agent_support_test.rb                                                             @getsentry/bilby
test/models/users/suspension_test.rb                                                                      @getsentry/bilby
test/models/users/tags_test.rb                                                                            @getsentry/bilby
test/models/users/ticket_sharing_support_test.rb                                                          @getsentry/boxoffice @getsentry/popcorn
test/models/users/zopim_support_test.rb                                                                   @getsentry/firefly @getsentry/bilby
test/models/voice/                                                                                        @getsentry/voice
test/models/workspace_element_test.rb                                                                     @getsentry/kingfisher
test/models/workspace_test.rb                                                                             @getsentry/kingfisher
test/models/zero_state_dismissal_test.rb                                                                  @getsentry/ponderosa
test/models/zopim/agent_test.rb                                                                           @getsentry/bilby
test/models/zopim/agents/creation_test.rb                                                                 @getsentry/bilby
test/models/zopim/trial_test.rb                                                                           @getsentry/chat-growth
test/models/zopim_integration_test.rb                                                                     @getsentry/teapot @getsentry/tealeaves
test/observers/account_product_state_observer_test.rb                                                     @getsentry/bilby
test/observers/billing_admin_event_observer_test.rb                                                       @getsentry/audit-log
test/observers/brand_entity_observer_test.rb                                                              @getsentry/piratos
test/observers/brand_event_bus_observer_test.rb                                                           @getsentry/ingest @getsentry/boxoffice @getsentry/popcorn
test/observers/brand_logo_observer_test.rb                                                                @getsentry/piratos
test/observers/certificate_observer_test.rb                                                               @getsentry/piratos
test/observers/custom_field_value_observer_test.rb                                                        @getsentry/vinyl
test/observers/dropdown_observer_test.rb                                                                  @getsentry/kowari @getsentry/vinyl
test/observers/group_domain_event_observer_test.rb                                                        @getsentry/bolt @getsentry/bilby @getsentry/audit-log
test/observers/group_entity_observer_test.rb                                                              @getsentry/bolt @getsentry/bilby @getsentry/mongooses
test/observers/permission_event_observer_test.rb                                                          @getsentry/audit-log
test/observers/permission_explore_entitlements_changes_observer_test.rb                                   @getsentry/bilby
test/observers/permission_guide_entitlements_changes_observer_test.rb                                     @getsentry/bilby
test/observers/permission_set_observer_test.rb                                                            @getsentry/firefly
test/observers/push_notification_observer_test.rb                                                         @getsentry/boxoffice @getsentry/popcorn
test/observers/subscription_product_state_observer_test.rb                                                @getsentry/bilby
test/observers/user_guide_entitlements_changes_observer_test.rb                                           @getsentry/bilby
test/observers/user_identity_observer_test.rb                                                             @getsentry/bilby
test/observers/user_name_event_observer_test.rb                                                           @getsentry/audit-log
test/observers/user_observer_test.rb                                                                      @getsentry/bilby
test/observers/user_otp_setting_observer_test.rb                                                          @getsentry/secdev @getsentry/bilby
test/observers/user_seat_changes_observer_test.rb                                                         @getsentry/bilby
test/observers/views_observers/                                                                           @getsentry/ingest
test/presenters/api/lotus/agent_collection_presenter_test.rb                                              @getsentry/harrier
test/presenters/api/lotus/answer_bot_notification_presenter_test.rb                                       @getsentry/orchid
test/presenters/api/lotus/assignables/                                                                    @getsentry/harrier
test/presenters/api/lotus/ccs_and_followers/                                                              @getsentry/strongbad
test/presenters/api/lotus/chat_settings_presenter_test.rb                                                 @getsentry/iris
test/presenters/api/lotus/collaboration_event_presenter_test.rb                                           @getsentry/collaboration
test/presenters/api/lotus/conversation_collection_presenter_test.rb                                       @getsentry/orchid
test/presenters/api/lotus/conversation_cursor_collection_presenter_test.rb                                @getsentry/squonk
test/presenters/api/lotus/conversation_item_presenter_test.rb                                             @getsentry/orchid
test/presenters/api/lotus/deleted_ticket_presenter_test.rb                                                @getsentry/boxoffice @getsentry/popcorn
test/presenters/api/lotus/group_collection_presenter_test.rb                                              @getsentry/harrier
test/presenters/api/lotus/group_presenter_test.rb                                                         @getsentry/harrier
test/presenters/api/lotus/knowledge_event_presenter_test.rb                                               @getsentry/orchid
test/presenters/api/lotus/macro_application_presenter_test.rb                                             @getsentry/fang
test/presenters/api/lotus/macro_collection_presenter_test.rb                                              @getsentry/fang
test/presenters/api/lotus/macro_presenter_test.rb                                                         @getsentry/fang
test/presenters/api/lotus/recent_ticket_presenter_test.rb                                                 @getsentry/orchid
test/presenters/api/lotus/simplified_email_threading/                                                     @getsentry/strongbad
test/presenters/api/lotus/time_zone_presenter_test.rb                                                     @getsentry/harrier
test/presenters/api/lotus/workspace_changed_presenter_test.rb                                             @getsentry/kingfisher
test/presenters/api/mobile/                                                                               @getsentry/lir
test/presenters/api/private/mobile_sdk/                                                                   @getsentry/lir
test/presenters/api/services/salesforce/                                                                  @getsentry/platycorn
test/presenters/api/v1/stats_presenter_test.rb                                                            @getsentry/foundation-analytics-stream
test/presenters/api/v2/abilities/                                                                         @getsentry/bilby @getsentry/firefly
test/presenters/api/v2/account/addons_presenter_test.rb                                                   @getsentry/narwhals @getsentry/otters
test/presenters/api/v2/account/boosts_presenter_test.rb                                                   @getsentry/narwhals @getsentry/otters
test/presenters/api/v2/account/explore_subscription_presenter_test.rb                                     @getsentry/kepler
test/presenters/api/v2/account/explore_subscription_pricing_presenter_test.rb                             @getsentry/narwhals @getsentry/otters
test/presenters/api/v2/account/features_presenter_test.rb                                                 @getsentry/quoll
test/presenters/api/v2/account/guide_subscription_pricing_presenter_test.rb                               @getsentry/narwhals @getsentry/otters
test/presenters/api/v2/account/hc_settings_presenter_test.rb                                              @getsentry/guide-dev
test/presenters/api/v2/account/multiproduct_presenter_test.rb                                             @getsentry/narwhals @getsentry/otters
test/presenters/api/v2/account/sandboxes_presenter_test.rb                                                @getsentry/ngiyari @getsentry/pcc-operations
test/presenters/api/v2/account/settings_presenter_test.rb                                                 @getsentry/bolt
test/presenters/api/v2/account/subscription_presenter_test.rb                                             @getsentry/narwhals @getsentry/otters
test/presenters/api/v2/account/subscription_voice_presenter_test.rb                                       @getsentry/voice
test/presenters/api/v2/account/tpe_subscription_pricing_presenter_test.rb                                 @getsentry/narwhals @getsentry/otters
test/presenters/api/v2/account/voice_partner_edition_account_presenter_test.rb                            @getsentry/zenguins
test/presenters/api/v2/account/voice_subscription/                                                        @getsentry/voice
test/presenters/api/v2/account/zendesk_subscription_pricing_presenter_test.rb                             @getsentry/narwhals @getsentry/otters
test/presenters/api/v2/account/zopim_agent_presenter_test.rb                                              @getsentry/narwhals @getsentry/otters
test/presenters/api/v2/account/zopim_subscription_presenter_test.rb                                       @getsentry/narwhals @getsentry/otters
test/presenters/api/v2/account/zopim_subscription_pricing_presenter_test.rb                               @getsentry/narwhals @getsentry/otters
test/presenters/api/v2/admin_brand_presenter_test.rb                                                      @getsentry/boxoffice @getsentry/popcorn
test/presenters/api/v2/agent_brand_presenter_test.rb                                                      @getsentry/boxoffice @getsentry/popcorn
test/presenters/api/v2/audit_log_presenter_test.rb                                                        @getsentry/audit-log
test/presenters/api/v2/automatic_answer_presenter_test.rb                                                 @getsentry/waratah
test/presenters/api/v2/billing/                                                                           @getsentry/narwhals @getsentry/otters
test/presenters/api/v2/brand_presenter_test.rb                                                            @getsentry/boxoffice @getsentry/popcorn
test/presenters/api/v2/crm_data_presenter_test.rb                                                         @getsentry/platycorn
test/presenters/api/v2/custom_field_option_presenter_test.rb                                              @getsentry/boxoffice @getsentry/popcorn
test/presenters/api/v2/custom_field_presenter_test.rb                                                     @getsentry/boxoffice @getsentry/popcorn
test/presenters/api/v2/custom_status_presenter_test.rb                                                    @getsentry/boxoffice @getsentry/popcorn
test/presenters/api/v2/exports/cursor_support_test.rb                                                     @getsentry/bilby
test/presenters/api/v2/exports/incremental_ticket_presenter_test.rb                                       @getsentry/dugong
test/presenters/api/v2/exports/incremental_user_presenter_test.rb                                         @getsentry/bilby
test/presenters/api/v2/feature_usage_metrics_presenter_test.rb                                            @getsentry/fang @getsentry/libretto
test/presenters/api/v2/gooddata_integration_presenter_test.rb                                             @getsentry/waratah
test/presenters/api/v2/group_membership_presenter_test.rb                                                 @getsentry/bolt @getsentry/bilby
test/presenters/api/v2/group_presenter_test.rb                                                            @getsentry/bolt @getsentry/bilby @getsentry/teapot @getsentry/tealeaves
test/presenters/api/v2/identity_presenter_test.rb                                                         @getsentry/bilby
test/presenters/api/v2/integrations/jira_presenter_test.rb                                                @getsentry/pegasus
test/presenters/api/v2/internal/account_settings_presenter_test.rb                                        @getsentry/teapot @getsentry/tealeaves
test/presenters/api/v2/internal/acme_certificate_job_status_presenter_test.rb                             @getsentry/secdev
test/presenters/api/v2/internal/billing/                                                                  @getsentry/narwhals @getsentry/otters
test/presenters/api/v2/internal/certificate_ip_presenter_test.rb                                          @getsentry/secdev
test/presenters/api/v2/internal/compliance_moves_presenter_test.rb                                        @getsentry/productivity-deploy
test/presenters/api/v2/internal/data_deletion_audit_job_presenter_test.rb                                 @getsentry/account-data-deletion
test/presenters/api/v2/internal/data_deletion_audit_presenter_test.rb                                     @getsentry/account-data-deletion
test/presenters/api/v2/internal/emails_presenter_test.rb                                                  @getsentry/strongbad
test/presenters/api/v2/internal/external_email_credential_presenter_test.rb                               @getsentry/strongbad
test/presenters/api/v2/internal/fraud*                                                                    @getsentry/orca
test/presenters/api/v2/internal/global_inbound_mail_rate_limit_presenter_test.rb                          @getsentry/strongbad
test/presenters/api/v2/internal/inbound_mail_rate_limit_audit_log_presenter_test.rb                       @getsentry/strongbad
test/presenters/api/v2/internal/inbound_mail_rate_limit_presenter_test.rb                                 @getsentry/strongbad
test/presenters/api/v2/internal/monitor/fraud*                                                            @getsentry/orca
test/presenters/api/v2/internal/monitor/mobile_sdk_app_settings_presenter_test.rb                         @getsentry/lir
test/presenters/api/v2/internal/monitor/mobile_sdk_blips_presenter_test.rb                                @getsentry/lir
test/presenters/api/v2/internal/prediction_settings_presenter_test.rb                                     @getsentry/waratah
test/presenters/api/v2/internal/recipient_address_presenter_test.rb                                       @getsentry/strongbad
test/presenters/api/v2/internal/remote_authentications_presenter_test.rb                                  @getsentry/unagi
test/presenters/api/v2/internal/rule_count_presenter_test.rb                                              @getsentry/fang @getsentry/libretto
test/presenters/api/v2/internal/security_settings_presenter_test.rb                                       @getsentry/secdev @getsentry/unagi
test/presenters/api/v2/internal/staff_presenter_test.rb                                                   @getsentry/bilby
test/presenters/api/v2/jetpack_task_presenter_test.rb                                                     @getsentry/ponderosa
test/presenters/api/v2/job_status_presenter_test.rb                                                       @getsentry/bolt
test/presenters/api/v2/lookup_field_options_presenter_test.rb                                             @getsentry/vinyl
test/presenters/api/v2/lookup_relationships_helper_test.rb                                                @getsentry/vinyl
test/presenters/api/v2/mobile_sdk_app_presenter_test.rb                                                   @getsentry/lir
test/presenters/api/v2/onboarding_tasks_presenter_test.rb                                                 @getsentry/ponderosa
test/presenters/api/v2/organization_membership_presenter_test.rb                                          @getsentry/kowari
test/presenters/api/v2/organization_related_presenter_test.rb                                             @getsentry/kowari
test/presenters/api/v2/organization_subscription_presenter_test.rb                                        @getsentry/kowari
test/presenters/api/v2/organizations/                                                                     @getsentry/kowari
test/presenters/api/v2/permissions/permissions_presenter_test.rb                                          @getsentry/firefly
test/presenters/api/v2/product_collection_presenter_test.rb                                               @getsentry/harrier
test/presenters/api/v2/recipient_address_presenter_test.rb                                                @getsentry/strongbad
test/presenters/api/v2/requests/custom_status_presenter_test.rb                                           @getsentry/boxoffice @getsentry/popcorn
test/presenters/api/v2/requests/group_presenter_test.rb                                                   @getsentry/bolt
test/presenters/api/v2/requests/organization_presenter_test.rb                                            @getsentry/kowari
test/presenters/api/v2/roles/                                                                             @getsentry/firefly
test/presenters/api/v2/routing/                                                                           @getsentry/argonauts
test/presenters/api/v2/rules/                                                                             @getsentry/fang @getsentry/libretto
test/presenters/api/v2/rules/automation_presenter_test.rb                                                 @getsentry/libretto
test/presenters/api/v2/rules/hydrate_ticket_presenter_test.rb                                             @getsentry/views-core @getsentry/views-enablement
test/presenters/api/v2/rules/macro_*                                                                      @getsentry/fang
test/presenters/api/v2/rules/relationship_definitions_presenter_test.rb                                   @getsentry/vinyl
test/presenters/api/v2/rules/rule_category_*                                                              @getsentry/libretto
test/presenters/api/v2/rules/rule_diff_presenter_test.rb                                                  @getsentry/libretto
test/presenters/api/v2/rules/trigger_*                                                                    @getsentry/libretto
test/presenters/api/v2/rules/user_view_*                                                                  @getsentry/penguin
test/presenters/api/v2/rules/view_*                                                                       @getsentry/fang
test/presenters/api/v2/rules/view_rows_presenter_test.rb                                                  @getsentry/views-core @getsentry/views-enablement
test/presenters/api/v2/salesforce_presenter_test.rb                                                       @getsentry/platycorn
test/presenters/api/v2/satisfaction_rating_presenter_test.rb                                              @getsentry/fang
test/presenters/api/v2/satisfaction_rating_statistics_presenter_test.rb                                   @getsentry/fang
test/presenters/api/v2/satisfaction_reason_presenter_test.rb                                              @getsentry/fang
test/presenters/api/v2/schedule_presenter_test.rb                                                         @getsentry/fang
test/presenters/api/v2/search/                                                                            @getsentry/search
test/presenters/api/v2/sharing_agreement_presenter_test.rb                                                @getsentry/boxoffice @getsentry/popcorn
test/presenters/api/v2/skip_presenter_test.rb                                                             @getsentry/argonauts
test/presenters/api/v2/slas/                                                                              @getsentry/fang
test/presenters/api/v2/suspended_ticket_presenter_test.rb                                                 @getsentry/strongbad
test/presenters/api/v2/tags_presenter_test.rb                                                             @getsentry/boxoffice @getsentry/popcorn
test/presenters/api/v2/target_failure_presenter_test.rb                                                   @getsentry/vegemite
test/presenters/api/v2/target_presenter_test.rb                                                           @getsentry/vegemite
test/presenters/api/v2/ticket_field_condition_presenter_test.rb                                           @getsentry/boxoffice @getsentry/popcorn
test/presenters/api/v2/ticket_field_presenter_test.rb                                                     @getsentry/boxoffice @getsentry/popcorn
test/presenters/api/v2/ticket_form_presenter_test.rb                                                      @getsentry/boxoffice @getsentry/popcorn
test/presenters/api/v2/tickets/attribute_mappings_test.rb                                                 @getsentry/boxoffice @getsentry/popcorn
test/presenters/api/v2/tickets/audit_custom_status_presenter_test.rb                                      @getsentry/boxoffice @getsentry/popcorn
test/presenters/api/v2/tickets/audit_event_collection_presenter_test.rb                                   @getsentry/boxoffice @getsentry/popcorn
test/presenters/api/v2/tickets/audit_event_presenter_test.rb                                              @getsentry/boxoffice @getsentry/popcorn
test/presenters/api/v2/tickets/audit_presenter_test.rb                                                    @getsentry/boxoffice @getsentry/popcorn
test/presenters/api/v2/tickets/cc_presenter_test.rb                                                       @getsentry/boxoffice @getsentry/popcorn
test/presenters/api/v2/tickets/ccs_and_followers_helper_test.rb                                           @getsentry/strongbad
test/presenters/api/v2/tickets/change_presenter_test.rb                                                   @getsentry/boxoffice @getsentry/popcorn
test/presenters/api/v2/tickets/chat_event_presenter_test.rb                                               @getsentry/teapot @getsentry/tealeaves
test/presenters/api/v2/tickets/comment_collection_presenter_test.rb                                       @getsentry/boxoffice @getsentry/popcorn
test/presenters/api/v2/tickets/comment_presenter_test.rb                                                  @getsentry/boxoffice @getsentry/popcorn
test/presenters/api/v2/tickets/comment_privacy_change_presenter_test.rb                                   @getsentry/orchid
test/presenters/api/v2/tickets/create_presenter_test.rb                                                   @getsentry/boxoffice @getsentry/popcorn
test/presenters/api/v2/tickets/email_cc_change_presenter_test.rb                                          @getsentry/strongbad
test/presenters/api/v2/tickets/email_comment_issue_presenter_test.rb                                      @getsentry/strongbad
test/presenters/api/v2/tickets/error_presenter_test.rb                                                    @getsentry/boxoffice @getsentry/popcorn
test/presenters/api/v2/tickets/errors_presenter_test.rb                                                   @getsentry/boxoffice @getsentry/popcorn
test/presenters/api/v2/tickets/event_via_presenter_test.rb                                                @getsentry/fang @getsentry/libretto
test/presenters/api/v2/tickets/external_presenter_test.rb                                                 @getsentry/boxoffice @getsentry/popcorn
test/presenters/api/v2/tickets/facebook_comment_presenter_test.rb                                         @getsentry/ocean
test/presenters/api/v2/tickets/facebook_event_presenter_test.rb                                           @getsentry/ocean
test/presenters/api/v2/tickets/follower_change_presenter_test.rb                                          @getsentry/strongbad
test/presenters/api/v2/tickets/follower_notification_presenter_test.rb                                    @getsentry/strongbad
test/presenters/api/v2/tickets/generic_comment_presenter_test.rb                                          @getsentry/boxoffice @getsentry/popcorn
test/presenters/api/v2/tickets/log_me_in_transcript_presenter_test.rb                                     @getsentry/boxoffice @getsentry/popcorn
test/presenters/api/v2/tickets/macro_reference_presenter_test.rb                                          @getsentry/fang
test/presenters/api/v2/tickets/messaging_csat_event_presenter_test.rb                                     @getsentry/teapot @getsentry/tealeaves
test/presenters/api/v2/tickets/messaging_event_presenter_test.rb                                          @getsentry/snoop
test/presenters/api/v2/tickets/mobile_ticket_presenter_test.rb                                            @getsentry/lir
test/presenters/api/v2/tickets/notification_presenter_test.rb                                             @getsentry/boxoffice @getsentry/popcorn
test/presenters/api/v2/tickets/organization_activity_presenter_test.rb                                    @getsentry/kowari
test/presenters/api/v2/tickets/prediction_presenter_test.rb                                               @getsentry/bunyip
test/presenters/api/v2/tickets/push_presenter_test.rb                                                     @getsentry/boxoffice @getsentry/popcorn
test/presenters/api/v2/tickets/re_engagement_sent_presenter_test.rb                                       @getsentry/woodstock
test/presenters/api/v2/tickets/related_presenter_test.rb                                                  @getsentry/boxoffice @getsentry/popcorn
test/presenters/api/v2/tickets/reply_options_presenter_test.rb                                            @getsentry/ocean
test/presenters/api/v2/tickets/rule_revision_via_presenter_test.rb                                        @getsentry/libretto
test/presenters/api/v2/tickets/rule_via_presenter_test.rb                                                 @getsentry/fang @getsentry/libretto
test/presenters/api/v2/tickets/satisfaction_rating_event_presenter_test.rb                                @getsentry/fang
test/presenters/api/v2/tickets/sla_target_change_presenter_test.rb                                        @getsentry/fang
test/presenters/api/v2/tickets/sms_notification_presenter_test.rb                                         @getsentry/voice
test/presenters/api/v2/tickets/ticket_params_test.rb                                                      @getsentry/boxoffice @getsentry/popcorn
test/presenters/api/v2/tickets/ticket_permissions_presenter_test.rb                                       @getsentry/boxoffice @getsentry/popcorn
test/presenters/api/v2/tickets/ticket_presenter_test.rb                                                   @getsentry/boxoffice @getsentry/popcorn
test/presenters/api/v2/tickets/ticket_sharing_event_presenter_test.rb                                     @getsentry/boxoffice @getsentry/popcorn
test/presenters/api/v2/tickets/translatable_error_presenter_test.rb                                       @getsentry/boxoffice
test/presenters/api/v2/tickets/twitter_event_presenter_test.rb                                            @getsentry/ocean
test/presenters/api/v2/tickets/user_custom_field_event_presenter_test.rb                                  @getsentry/boxoffice @getsentry/popcorn @getsentry/bilby @getsentry/vinyl
test/presenters/api/v2/tickets/voice_comment_presenter_test.rb                                            @getsentry/voice
test/presenters/api/v2/user_related_presenter_test.rb                                                     @getsentry/boxoffice @getsentry/popcorn
test/presenters/api/v2/users/                                                                             @getsentry/bilby
test/presenters/api/v2/users/compliance_deletion_status_presenter_test.rb                                 @getsentry/spyglass
test/presenters/api/v2/users/entitlement_presenter_test.rb                                                @getsentry/aviators
test/presenters/api/v2/users/minimal_user_presenter_test.rb                                               @getsentry/boxoffice @getsentry/popcorn
test/presenters/api/v2/workspace_definitions_presenter_test.rb                                            @getsentry/kingfisher
test/presenters/api/v2/workspace_presenter_test.rb                                                        @getsentry/kingfisher
test/presenters/cia/                                                                                      @getsentry/audit-log
test/protobuf_encoders/account_protobuf_encoder_test.rb                                                   @getsentry/quoll
test/protobuf_encoders/account_setting_protobuf_encoder_test.rb                                           @getsentry/quoll
test/protobuf_encoders/assumption_events_protobuf_encoder_test.rb                                         @getsentry/secdev
test/protobuf_encoders/attachment_protobuf_encoder_test.rb                                                @getsentry/squonk
test/protobuf_encoders/audit_event_protobuf_encoder_test.rb                                               @getsentry/audit-log
test/protobuf_encoders/brand_events/                                                                      @getsentry/ingest @getsentry/boxoffice @getsentry/popcorn
test/protobuf_encoders/brand_events_protobuf_encoder_test.rb                                              @getsentry/boxoffice @getsentry/popcorn
test/protobuf_encoders/brand_protobuf_encoder_test.rb                                                     @getsentry/boxoffice @getsentry/popcorn
test/protobuf_encoders/business_rule_matched_protobuf_encoder_test.rb                                     @getsentry/vegemite
test/protobuf_encoders/comment_protobuf_encoder_test.rb                                                   @getsentry/ticket-platform
test/protobuf_encoders/csat_requested_protobuf_encoder_test.rb                                            @getsentry/snoop
test/protobuf_encoders/custom_field_protobuf_encoder_test.rb                                              @getsentry/bilby
test/protobuf_encoders/custom_status_protobuf_encoder_test.rb                                             @getsentry/boxoffice
test/protobuf_encoders/group_events/                                                                      @getsentry/bolt @getsentry/audit-log
test/protobuf_encoders/group_events_protobuf_encoder_test.rb                                              @getsentry/bolt @getsentry/audit-log
test/protobuf_encoders/group_protobuf_encoder_test.rb                                                     @getsentry/bolt @getsentry/teapot @getsentry/tealeaves
test/protobuf_encoders/locale_protobuf_encoder_test.rb                                                    @getsentry/quoll
test/protobuf_encoders/organization_*.rb                                                                  @getsentry/kowari
test/protobuf_encoders/organization_events/                                                               @getsentry/kowari
test/protobuf_encoders/organization_events_protobuf_encoder_test.rb                                       @getsentry/kowari
test/protobuf_encoders/organization_protobuf_encoder_test.rb                                              @getsentry/kowari
test/protobuf_encoders/route_protobuf_encoder_test.rb                                                     @getsentry/boxoffice @getsentry/popcorn
test/protobuf_encoders/routing_assignment_failure_protobuf_encoder_test.rb                                @getsentry/silk-road @getsentry/tea-horse
test/protobuf_encoders/routing_tasks_actor_list_encoder_test.rb                                           @getsentry/silk-road @getsentry/tea-horse
test/protobuf_encoders/routing_tasks_data_encoder_test.rb                                                 @getsentry/silk-road @getsentry/tea-horse
test/protobuf_encoders/routing_tasks_group_data_encoder_test.rb                                           @getsentry/silk-road @getsentry/tea-horse
test/protobuf_encoders/satisfaction_score_protobuf_encoder_test.rb                                        @getsentry/fang
test/protobuf_encoders/status_category_protobuf_encoder_test.rb                                           @getsentry/boxoffice
test/protobuf_encoders/ticket_events/                                                                     @getsentry/ticket-platform
test/protobuf_encoders/ticket_events/custom_status_changed_protobuf_encoder_test.rb                       @getsentry/boxoffice
test/protobuf_encoders/ticket_events/schedule_changed_protobuf_encoder_test.rb                            @getsentry/fang
test/protobuf_encoders/ticket_events/sla_policy_changed_protobuf_encoder_test.rb                          @getsentry/fang
test/protobuf_encoders/ticket_events_protobuf_encoder_test.rb                                             @getsentry/ticket-platform
test/protobuf_encoders/ticket_field_entry_value_protobuf_encoder_test.rb                                  @getsentry/ingest
test/protobuf_encoders/ticket_field_protobuf_encoder_test.rb                                              @getsentry/boxoffice @getsentry/popcorn
test/protobuf_encoders/ticket_form_protobuf_encoder_test.rb                                               @getsentry/boxoffice @getsentry/popcorn
test/protobuf_encoders/ticket_priority_protobuf_encoder_test.rb                                           @getsentry/boxoffice @getsentry/popcorn
test/protobuf_encoders/ticket_protobuf_encoder_test.rb                                                    @getsentry/boxoffice @getsentry/popcorn
test/protobuf_encoders/ticket_status_protobuf_encoder_test.rb                                             @getsentry/boxoffice @getsentry/popcorn
test/protobuf_encoders/ticket_type_protobuf_encoder_test.rb                                               @getsentry/boxoffice @getsentry/popcorn
test/protobuf_encoders/timestamps_protobuf_encoder_test.rb                                                @getsentry/ticket-platform
test/protobuf_encoders/user_authentication_event_protobuf_encoder_test.rb                                 @getsentry/argonauts
test/protobuf_encoders/user_events/                                                                       @getsentry/bilby
test/protobuf_encoders/user_events_protobuf_encoder_test.rb                                               @getsentry/bilby
test/protobuf_encoders/user_logged_in_event_protobuf_encoder_test.rb                                      @getsentry/argonauts @getsentry/bilby
test/protobuf_encoders/user_logged_out_event_protobuf_encoder_test.rb                                     @getsentry/argonauts @getsentry/bilby
test/protobuf_encoders/user_protobuf_encoder_test.rb                                                      @getsentry/piratos @getsentry/bilby
test/protobuf_encoders/user_role_protobuf_encoder_test.rb                                                 @getsentry/bilby
test/protobuf_encoders/user_role_v2_protobuf_encoder_test.rb                                              @getsentry/bilby
test/protobuf_encoders/user_v2_protobuf_encoder_test.rb                                                   @getsentry/bilby
test/protobuf_encoders/via_type_protobuf_encoder_test.rb                                                  @getsentry/ticket-platform
test/protobuf_encoders/views_encoders/                                                                    @getsentry/ingest
test/protobuf_encoders/zendesk_protobuf_encoder_test.rb                                                   @getsentry/bolt
test/rubo_cop/cop/lint/json_serialization_test.rb                                                         @getsentry/classic-core-cph
test/services/account_name_propagator_test.rb                                                             @getsentry/quoll
test/services/account_subdomain_propagator_test.rb                                                        @getsentry/quoll
test/services/account_synchronizer_test.rb                                                                @getsentry/narwhals @getsentry/otters
test/services/base_test.rb                                                                                @getsentry/narwhals @getsentry/otters
test/services/billing/                                                                                    @getsentry/narwhals @getsentry/otters
test/services/brand_publisher_test.rb                                                                     @getsentry/piratos
test/services/csat_requested_publisher_test.rb                                                            @getsentry/snoop
test/services/custom_field/relationship_field_index_synchronizer_test.rb                                  @getsentry/vinyl
test/services/custom_field/sources_retriever_test.rb                                                      @getsentry/vinyl
test/services/group_publisher_test.rb                                                                     @getsentry/bolt @getsentry/mongooses
test/services/provisioning/                                                                               @getsentry/narwhals @getsentry/otters
test/services/provisioning_test.rb                                                                        @getsentry/narwhals @getsentry/otters
test/services/resend_account_owner_welcome_email_test.rb                                                  @getsentry/secdev
test/services/ticket_deflector_test.rb                                                                    @getsentry/waratah
test/services/user_entity_publisher_test.rb                                                               @getsentry/piratos @getsentry/bilby
test/support/agent_test_helper.rb                                                                         @getsentry/strongbad
test/support/api_activity_test_helper.rb                                                                  @getsentry/bolt @getsentry/bilby
test/support/api_v2_test_helper.rb                                                                        @getsentry/bolt @getsentry/bilby
test/support/archive_helper.rb                                                                            @getsentry/support-ticket-archiving
test/support/arturo_slider_helper.rb                                                                      @getsentry/views-core @getsentry/views-enablement
test/support/audit_logs_test_helper.rb                                                                    @getsentry/audit-log
test/support/authentication_test_helper.rb                                                                @getsentry/secdev @getsentry/unagi
test/support/billing_test_helper.rb                                                                       @getsentry/narwhals @getsentry/otters
test/support/brand_test_helper.rb                                                                         @getsentry/bilby
test/support/business_hours_test_helper.rb                                                                @getsentry/fang
test/support/certificate_test_helper.rb                                                                   @getsentry/secdev
test/support/channels_test_helper.rb                                                                      @getsentry/ocean
test/support/cms_references_helper.rb                                                                     @getsentry/athene
test/support/collaboration_settings_test_helper.rb                                                        @getsentry/strongbad
test/support/collaboration_test_helper.rb                                                                 @getsentry/strongbad
test/support/configuration_helper.rb                                                                      @getsentry/bolt
test/support/custom_field_options_test_helper.rb                                                          @getsentry/boxoffice @getsentry/popcorn
test/support/custom_fields_test_helper.rb                                                                 @getsentry/boxoffice @getsentry/popcorn @getsentry/vinyl
test/support/domain_events_helper.rb                                                                      @getsentry/bilby
test/support/fake_esc_kafka_message.rb                                                                    @getsentry/ticket-platform
test/support/forking_test_runner_test_helper.rb                                                           @getsentry/bolt
test/support/inbound_mail_rate_limit_test_helper.rb                                                       @getsentry/strongbad
test/support/inbound_outbound_email_helper.rb                                                             @getsentry/strongbad
test/support/lookup_relationship_source_test_helper.rb                                                    @getsentry/vinyl
test/support/mail_test_helper.rb                                                                          @getsentry/strongbad
test/support/mobile_sdk_rate_limit_helper.rb                                                              @getsentry/lir
test/support/multiproduct_test_helper.rb                                                                  @getsentry/bilby
test/support/pre_account_creation_helper.rb                                                               @getsentry/bilby
test/support/routing/                                                                                     @getsentry/argonauts
test/support/rubocop/                                                                                     @getsentry/squonk
test/support/rule.rb                                                                                      @getsentry/fang @getsentry/libretto
test/support/rule/                                                                                        @getsentry/fang @getsentry/libretto
test/support/rule_query_builder_test_helper.rb                                                            @getsentry/fang @getsentry/libretto
test/support/rules_test_helper.rb                                                                         @getsentry/fang @getsentry/libretto
test/support/salesforce_test_helper.rb                                                                    @getsentry/platycorn
test/support/sandbox_test_helper.rb                                                                       @getsentry/ngiyari @getsentry/pcc-operations
test/support/satisfaction_test_helper.rb                                                                  @getsentry/fang
test/support/sharing_test_helper.rb                                                                       @getsentry/boxoffice @getsentry/popcorn
test/support/simplified_email_threading/                                                                  @getsentry/strongbad
test/support/suite_test_helper.rb                                                                         @getsentry/narwhals @getsentry/otters
test/support/test_helper.rb                                                                               @getsentry/bolt @getsentry/rails-upgrade
test/support/ticket_test_helper.rb                                                                        @getsentry/boxoffice @getsentry/popcorn
test/support/views_rate_limit_support.rb                                                                  @getsentry/views-core @getsentry/views-enablement
test/support/voice_comment_test_helper.rb                                                                 @getsentry/kelpie
test/support/voice_helper.rb                                                                              @getsentry/voice
test/support/voice_test_helper.rb                                                                         @getsentry/voice
vendor/*/aasm-*.gem                                                                                       @getsentry/rails-upgrade
vendor/*/abbreviato-*.gem                                                                                 @getsentry/strongbad
vendor/*/abstract_type-*.gem                                                                              @getsentry/rails-upgrade
vendor/*/acme-client-*.gem                                                                                @getsentry/rails-upgrade
vendor/*/action_mailer-enqueable-*.gem                                                                    @getsentry/strongbad
vendor/*/action_mailer-logged_smtp_delivery-*.gem                                                         @getsentry/strongbad
vendor/*/actioncable-*.gem                                                                                @getsentry/rails-upgrade
vendor/*/actionmailer-*.gem                                                                               @getsentry/rails-upgrade
vendor/*/actionpack-*.gem                                                                                 @getsentry/rails-upgrade
vendor/*/actionpack-action_caching-*.gem                                                                  @getsentry/rails-upgrade
vendor/*/actionpack-page_caching-*.gem                                                                    @getsentry/rails-upgrade
vendor/*/actionpack-xml_parser-*.gem                                                                      @getsentry/rails-upgrade
vendor/*/actionview-*.gem                                                                                 @getsentry/rails-upgrade
vendor/*/active_hash-*.gem                                                                                @getsentry/rails-upgrade
vendor/*/active_model_serializers-*.gem                                                                   @getsentry/rails-upgrade
vendor/*/active_record-comments-*.gem                                                                     @getsentry/rails-upgrade
vendor/*/active_record_host_pool-*.gem                                                                    @getsentry/ruby-core
vendor/*/active_record_inherit_assoc-*.gem                                                                @getsentry/rails-upgrade
vendor/*/active_record_shards-*.gem                                                                       @getsentry/rails-upgrade
vendor/*/activejob-*.gem                                                                                  @getsentry/rails-upgrade
vendor/*/activemodel-*.gem                                                                                @getsentry/rails-upgrade
vendor/*/activemodel-serializers-xml-*.gem                                                                @getsentry/rails-upgrade
vendor/*/activerecord-*.gem                                                                               @getsentry/rails-upgrade
vendor/*/activerecord-import-*.gem                                                                        @getsentry/ingest
vendor/*/activeresource-*.gem                                                                             @getsentry/rails-upgrade
vendor/*/activestorage-*.gem                                                                              @getsentry/rails-upgrade
vendor/*/activesupport-*.gem                                                                              @getsentry/rails-upgrade
vendor/*/addressable-*.gem                                                                                @getsentry/rails-upgrade
vendor/*/adrian-*.gem                                                                                     @getsentry/rails-upgrade
vendor/*/aes_key_wrap-*.gem                                                                               @getsentry/rails-upgrade
vendor/*/airbrussh-*.gem                                                                                  @getsentry/rails-upgrade
vendor/*/akami-*.gem                                                                                      @getsentry/rails-upgrade
vendor/*/allowed_parameters-*.gem                                                                         @getsentry/rails-upgrade
vendor/*/any_channel_json_schemas-*.gem                                                                   @getsentry/ocean
vendor/*/api_presentation-*.gem                                                                           @getsentry/bolt
vendor/*/arel-*.gem                                                                                       @getsentry/rails-upgrade
vendor/*/arsi-*.gem                                                                                       @getsentry/rails-upgrade
vendor/*/arturo-*.gem                                                                                     @getsentry/rails-upgrade
vendor/*/asset_host_selection-*.gem                                                                       @getsentry/bolt
vendor/*/ast-*.gem                                                                                        @getsentry/rails-upgrade
vendor/*/attr_required-*.gem                                                                              @getsentry/rails-upgrade
vendor/*/attr_selector-*.gem                                                                              @getsentry/bolt
vendor/*/awesome_print-*.gem                                                                              @getsentry/rails-upgrade
vendor/*/aws-eventstream-*.gem                                                                            @getsentry/rails-upgrade
vendor/*/aws-partitions-*.gem                                                                             @getsentry/rails-upgrade
vendor/*/aws-sdk-core-*.gem                                                                               @getsentry/rails-upgrade
vendor/*/aws-sdk-dynamodb-*.gem                                                                           @getsentry/ticket-platform
vendor/*/aws-sdk-ec2-*.gem                                                                                @getsentry/eng-productivity
vendor/*/aws-sdk-kms-*.gem                                                                                @getsentry/rails-upgrade
vendor/*/aws-sdk-s3-*.gem                                                                                 @getsentry/rails-upgrade
vendor/*/aws-sdk-sns-*.gem                                                                                @getsentry/rails-upgrade
vendor/*/aws-sdk-sqs-*.gem                                                                                @getsentry/rails-upgrade
vendor/*/aws-sigv4-*.gem                                                                                  @getsentry/rails-upgrade
vendor/*/base32-*.gem                                                                                     @getsentry/orca
vendor/*/basecamp-*.gem                                                                                   @getsentry/rails-upgrade
vendor/*/bcp47_spec-*.gem                                                                                 @getsentry/rails-upgrade
vendor/*/bcrypt-*.gem                                                                                     @getsentry/rails-upgrade
vendor/*/bcrypt-ruby-*.gem                                                                                @getsentry/rails-upgrade
vendor/*/beefcake-*.gem                                                                                   @getsentry/rails-upgrade
vendor/*/benchmark-ips-*.gem                                                                              @getsentry/rails-upgrade
vendor/*/benchmark-ipsa-*.gem                                                                             @getsentry/rails-upgrade
vendor/*/bindata-*.gem                                                                                    @getsentry/rails-upgrade
vendor/*/biz-*.gem                                                                                        @getsentry/fang
vendor/*/bootsnap-*.gem                                                                                   @getsentry/rails-upgrade
vendor/*/brakeman-*.gem                                                                                   @getsentry/rails-upgrade
vendor/*/bson-*.gem                                                                                       @getsentry/foundation-analytics-stream
vendor/*/buftok-*.gem                                                                                     @getsentry/rails-upgrade
vendor/*/builder-*.gem                                                                                    @getsentry/rails-upgrade
vendor/*/byebug*.gem                                                                                      @getsentry/ticket-platform
vendor/*/cert_validator-*.gem                                                                             @getsentry/rails-upgrade
vendor/*/charcoal-*.gem                                                                                   @getsentry/rails-upgrade
vendor/*/chunky_png*                                                                                      @getsentry/secdev
vendor/*/cia-*.gem                                                                                        @getsentry/secdev
vendor/*/circuitbox-*.gem                                                                                 @getsentry/ticket-platform
vendor/*/clavius-*.gem                                                                                    @getsentry/squonk
vendor/*/cld-2018-*.gem                                                                                   @getsentry/strongbad
vendor/*/closure-compiler-*.gem                                                                           @getsentry/rails-upgrade
vendor/*/code_owners*                                                                                     @getsentry/squonk
vendor/*/coderay-*.gem                                                                                    @getsentry/ticket-platform
vendor/*/coffee-rails-*.gem                                                                               @getsentry/rails-upgrade
vendor/*/coffee-script-*.gem                                                                              @getsentry/rails-upgrade
vendor/*/coffee-script-source-*.gem                                                                       @getsentry/rails-upgrade
vendor/*/color-*.gem                                                                                      @getsentry/rails-upgrade
vendor/*/concurable-*.gem                                                                                 @getsentry/ticket-platform
vendor/*/concurrent-ruby-*.gem                                                                            @getsentry/rails-upgrade
vendor/*/crack-*.gem                                                                                      @getsentry/rails-upgrade
vendor/*/crass-*.gem                                                                                      @getsentry/rails-upgrade
vendor/*/credit_card_sanitizer-*.gem                                                                      @getsentry/rails-upgrade
vendor/*/css_parser-*.gem                                                                                 @getsentry/rails-upgrade
vendor/*/dalli-*.gem                                                                                      @getsentry/bolt
vendor/*/dalli-elasticache-*.gem                                                                          @getsentry/rails-upgrade
vendor/*/ddtrace-*.gem                                                                                    @getsentry/bolt
vendor/*/deep_merge-*.gem                                                                                 @getsentry/rails-upgrade
vendor/*/delivery_boy-*.gem                                                                               @getsentry/ingest
vendor/*/delta_changes-*.gem                                                                              @getsentry/ticket-platform
vendor/*/digest-crc-*.gem                                                                                 @getsentry/rails-upgrade
vendor/*/digest-murmurhash-*.gem                                                                          @getsentry/ingest
vendor/*/diplomat-*.gem                                                                                   @getsentry/account-data-deletion
vendor/*/dkim-*.gem                                                                                       @getsentry/strongbad
vendor/*/dogapi-*.gem                                                                                     @getsentry/bolt
vendor/*/dogstatsd-ruby-*.gem                                                                             @getsentry/rails-upgrade
vendor/*/domain_name-*.gem                                                                                @getsentry/rails-upgrade
vendor/*/dotenv-*.gem                                                                                     @getsentry/rails-upgrade
vendor/*/ejs-*.gem                                                                                        @getsentry/rails-upgrade
vendor/*/email_storage_service_client-*.gem                                                               @getsentry/strongbad
vendor/*/equalizer-*.gem                                                                                  @getsentry/rails-upgrade
vendor/*/erubi-*.gem                                                                                      @getsentry/bolt
vendor/*/erubis-*.gem                                                                                     @getsentry/bolt
vendor/*/ethon-*.gem                                                                                      @getsentry/rails-upgrade
vendor/*/excon-*.gem                                                                                      @getsentry/rails-upgrade
vendor/*/execjs-*.gem                                                                                     @getsentry/rails-upgrade
vendor/*/factory_bot-*.gem                                                                                @getsentry/rails-upgrade
vendor/*/faraday-*.gem                                                                                    @getsentry/bolt
vendor/*/faraday_middleware-*.gem                                                                         @getsentry/bolt
vendor/*/fast_blank-*.gem                                                                                 @getsentry/rails-upgrade
vendor/*/fast_xs-*.gem                                                                                    @getsentry/rails-upgrade
vendor/*/fastimage-*.gem                                                                                  @getsentry/rails-upgrade
vendor/*/ffi-*.gem                                                                                        @getsentry/rails-upgrade
vendor/*/ffi-icu-*.gem                                                                                    @getsentry/i18n
vendor/*/finite_machine-*.gem                                                                             @getsentry/fang @getsentry/squonk
vendor/*/fog-aws-*.gem                                                                                    @getsentry/rails-upgrade
vendor/*/fog-core-*.gem                                                                                   @getsentry/rails-upgrade
vendor/*/fog-json-*.gem                                                                                   @getsentry/rails-upgrade
vendor/*/fog-xml-*.gem                                                                                    @getsentry/rails-upgrade
vendor/*/foreman-*.gem                                                                                    @getsentry/strongbad
vendor/*/forking_test_runner-*.gem                                                                        @getsentry/rails-upgrade
vendor/*/formatador-*.gem                                                                                 @getsentry/rails-upgrade
vendor/*/geoip-*.gem                                                                                      @getsentry/rails-upgrade
vendor/*/global_uid-*.gem                                                                                 @getsentry/database-gem-owners
vendor/*/globalid-*.gem                                                                                   @getsentry/rails-upgrade
vendor/*/gooddata_client-*.gem                                                                            @getsentry/kepler @getsentry/waratah
vendor/*/google-id-token-*.gem                                                                            @getsentry/secdev
vendor/*/google-protobuf-*.gem                                                                            @getsentry/bolt @getsentry/classic-core-cph
vendor/*/googleapis-common-protos-types-*.gem                                                             @getsentry/bolt
vendor/*/gpgme-*.gem                                                                                      @getsentry/rails-upgrade
vendor/*/gravatar-ultimate-*.gem                                                                          @getsentry/rails-upgrade
vendor/*/grpc-*.gem                                                                                       @getsentry/bolt
vendor/*/guide_plans-*.gem                                                                                @getsentry/vikings
vendor/*/gyoku-*.gem                                                                                      @getsentry/rails-upgrade
vendor/*/hashdiff-*.gem                                                                                   @getsentry/rails-upgrade
vendor/*/hashids-*.gem                                                                                    @getsentry/strongbad
vendor/*/hashie-*.gem                                                                                     @getsentry/rails-upgrade
vendor/*/help_center_stats-*.gem                                                                          @getsentry/foundation-analytics-stream
vendor/*/html-pipeline-*.gem                                                                              @getsentry/rails-upgrade
vendor/*/html_to_plain_text-*.gem                                                                         @getsentry/rails-upgrade
vendor/*/htmlentities-*.gem                                                                               @getsentry/rails-upgrade
vendor/*/http-*.gem                                                                                       @getsentry/rails-upgrade
vendor/*/http-accept-*.gem                                                                                @getsentry/bolt
vendor/*/http-cookie-*.gem                                                                                @getsentry/rails-upgrade
vendor/*/http-form_data-*.gem                                                                             @getsentry/rails-upgrade
vendor/*/http_accept_language-*.gem                                                                       @getsentry/rails-upgrade
vendor/*/http_parser.rb-*.gem                                                                             @getsentry/rails-upgrade
vendor/*/httparty-*.gem                                                                                   @getsentry/rails-upgrade
vendor/*/httpclient-*.gem                                                                                 @getsentry/rails-upgrade
vendor/*/httpi-*.gem                                                                                      @getsentry/rails-upgrade
vendor/*/i18n-*.gem                                                                                       @getsentry/rails-upgrade
vendor/*/idn-ruby-*.gem                                                                                   @getsentry/rails-upgrade
vendor/*/inflection-*.gem                                                                                 @getsentry/rails-upgrade
vendor/*/inifile-*.gem                                                                                    @getsentry/rails-upgrade
vendor/*/innertube-*.gem                                                                                  @getsentry/rails-upgrade
vendor/*/ipaddress-*.gem                                                                                  @getsentry/rails-upgrade
vendor/*/iron_bank-*.gem                                                                                  @getsentry/narwhals @getsentry/otters
vendor/*/iso8601-*.gem                                                                                    @getsentry/rails-upgrade
vendor/*/jira4r-*.gem                                                                                     @getsentry/rails-upgrade
vendor/*/jmespath-*.gem                                                                                   @getsentry/rails-upgrade
vendor/*/johnny_five-*.gem                                                                                @getsentry/bolt @getsentry/rails-upgrade
vendor/*/json-*.gem                                                                                       @getsentry/rails-upgrade
vendor/*/json-jwt-*.gem                                                                                   @getsentry/rails-upgrade
vendor/*/json-schema-*.gem                                                                                @getsentry/rails-upgrade
vendor/*/jwt-*.gem                                                                                        @getsentry/rails-upgrade
vendor/*/kasket-*.gem                                                                                     @getsentry/rails-upgrade
vendor/*/kgio-*.gem                                                                                       @getsentry/rails-upgrade
vendor/*/king_konf-*.gem                                                                                  @getsentry/rails-upgrade
vendor/*/kragle-*.gem                                                                                     @getsentry/bolt @getsentry/rails-upgrade
vendor/*/large_object_store-*.gem                                                                         @getsentry/bolt
vendor/*/ledger_client-*.gem                                                                              @getsentry/bilby
vendor/*/liquid-*.gem                                                                                     @getsentry/rails-upgrade
vendor/*/logcast-*.gem                                                                                    @getsentry/rails-upgrade
vendor/*/logger-application-*.gem                                                                         @getsentry/rails-upgrade
vendor/*/loofah-*.gem                                                                                     @getsentry/rails-upgrade
vendor/*/luhn_checksum-*.gem                                                                              @getsentry/rails-upgrade
vendor/*/macaddr-*.gem                                                                                    @getsentry/rails-upgrade
vendor/*/mail-*.gem                                                                                       @getsentry/strongbad
vendor/*/mail-iso-2022-jp-*.gem                                                                           @getsentry/strongbad
vendor/*/marcel-*.gem                                                                                     @getsentry/rails-upgrade
vendor/*/maxminddb-*.gem                                                                                  @getsentry/rails-upgrade
vendor/*/memflash-*.gem                                                                                   @getsentry/rails-upgrade
vendor/*/memoizable-*.gem                                                                                 @getsentry/rails-upgrade
vendor/*/memory_profiler-*.gem                                                                            @getsentry/rails-upgrade
vendor/*/method_source-*.gem                                                                              @getsentry/ticket-platform
vendor/*/migration_tools-*.gem                                                                            @getsentry/database-gem-owners
vendor/*/mime-types-*.gem                                                                                 @getsentry/rails-upgrade
vendor/*/mini_magick-*.gem                                                                                @getsentry/rails-upgrade
vendor/*/mini_portile2-*.gem                                                                              @getsentry/rails-upgrade
vendor/*/minitest*.gem                                                                                    @getsentry/rails-upgrade
vendor/*/mocha-*.gem                                                                                      @getsentry/rails-upgrade
vendor/*/moneta-*.gem                                                                                     @getsentry/ticket-platform
vendor/*/mongo-*.gem                                                                                      @getsentry/foundation-analytics-stream
vendor/*/mono_logger-*.gem                                                                                @getsentry/rails-upgrade
vendor/*/msgpack-*.gem                                                                                    @getsentry/rails-upgrade
vendor/*/multi_json-*.gem                                                                                 @getsentry/rails-upgrade
vendor/*/multi_xml-*.gem                                                                                  @getsentry/rails-upgrade
vendor/*/multipart-post-*.gem                                                                             @getsentry/bolt @getsentry/ocean
vendor/*/mustermann-*.gem                                                                                 @getsentry/rails-upgrade
vendor/*/mysql2-*.gem                                                                                     @getsentry/rails-upgrade
vendor/*/mysql_isolated_server-*.gem                                                                      @getsentry/rails-upgrade
vendor/*/nakayoshi_fork*.gem                                                                              @getsentry/bolt
vendor/*/naught-*.gem                                                                                     @getsentry/rails-upgrade
vendor/*/net-scp-*.gem                                                                                    @getsentry/rails-upgrade
vendor/*/net-ssh-*.gem                                                                                    @getsentry/rails-upgrade
vendor/*/netrc-*.gem                                                                                      @getsentry/rails-upgrade
vendor/*/nilsimsa*.gem                                                                                    @getsentry/orca
vendor/*/nio4r-*.gem                                                                                      @getsentry/rails-upgrade
vendor/*/nokogiri-*.gem                                                                                   @getsentry/rails-upgrade
vendor/*/nokogumbo-*.gem                                                                                  @getsentry/rails-upgrade
vendor/*/nori-*.gem                                                                                       @getsentry/rails-upgrade
vendor/*/oauth-*.gem                                                                                      @getsentry/secdev
vendor/*/oauth2-*.gem                                                                                     @getsentry/secdev
vendor/*/oauth2-client-*.gem                                                                              @getsentry/secdev
vendor/*/occam_client-*.gem                                                                               @getsentry/views-core @getsentry/views-enablement
vendor/*/octokit-*.gem                                                                                    @getsentry/rails-upgrade
vendor/*/oj-*.gem                                                                                         @getsentry/bolt
vendor/*/parallel-*.gem                                                                                   @getsentry/rails-upgrade
vendor/*/parallel_tests-*.gem                                                                             @getsentry/rails-upgrade
vendor/*/parser-*.gem                                                                                     @getsentry/rails-upgrade
vendor/*/path_expander*.gem                                                                               @getsentry/rails-upgrade
vendor/*/permalink_fu-*.gem                                                                               @getsentry/rails-upgrade
vendor/*/pg_query-*.gem                                                                                   @getsentry/rails-upgrade
vendor/*/phony-*.gem                                                                                      @getsentry/voice
vendor/*/pid_controller-*.gem                                                                             @getsentry/rails-upgrade
vendor/*/pluginator-*.gem                                                                                 @getsentry/rails-upgrade
vendor/*/pre-commit-*.gem                                                                                 @getsentry/rails-upgrade
vendor/*/predictive_load-*.gem                                                                            @getsentry/rails-upgrade
vendor/*/preload-*.gem                                                                                    @getsentry/rails-upgrade
vendor/*/premailer-*.gem                                                                                  @getsentry/rails-upgrade
vendor/*/prop-*.gem                                                                                       @getsentry/bolt
vendor/*/property_sets-*.gem                                                                              @getsentry/rails-upgrade
vendor/*/pry-*.gem                                                                                        @getsentry/ticket-platform
vendor/*/public_suffix-*.gem                                                                              @getsentry/rails-upgrade
vendor/*/r509-*.gem                                                                                       @getsentry/rails-upgrade
vendor/*/racc-*.gem                                                                                       @getsentry/rails-upgrade
vendor/*/racecar-*.gem                                                                                    @getsentry/rails-upgrade @getsentry/ingest
vendor/*/rack-*.gem                                                                                       @getsentry/rails-upgrade
vendor/*/rack-accept-*.gem                                                                                @getsentry/rails-upgrade
vendor/*/rack-cache-*.gem                                                                                 @getsentry/rails-upgrade
vendor/*/rack-oauth2-*.gem                                                                                @getsentry/rails-upgrade
vendor/*/rack-protection-*.gem                                                                            @getsentry/rails-upgrade
vendor/*/rack-test-*.gem                                                                                  @getsentry/rails-upgrade
vendor/*/rack-utf8_sanitizer-*.gem                                                                        @getsentry/rails-upgrade
vendor/*/radar_client_rb-*.gem                                                                            @getsentry/radar
vendor/*/radar_notification-*.gem                                                                         @getsentry/argonauts
vendor/*/rails-*.gem                                                                                      @getsentry/rails-upgrade
vendor/*/rails-dom-testing-*.gem                                                                          @getsentry/rails-upgrade
vendor/*/rails-html-sanitizer-*.gem                                                                       @getsentry/rails-upgrade
vendor/*/rails4_skip_action_patch-*.gem                                                                   @getsentry/rails-upgrade
vendor/*/rails_same_site_cookie-*.gem                                                                     @getsentry/secdev
vendor/*/rails_xss-*.gem                                                                                  @getsentry/rails-upgrade
vendor/*/railties-*.gem                                                                                   @getsentry/rails-upgrade
vendor/*/rainbow-*.gem                                                                                    @getsentry/rails-upgrade
vendor/*/raindrops-*.gem                                                                                  @getsentry/rails-upgrade
vendor/*/rake-*.gem                                                                                       @getsentry/rails-upgrade
vendor/*/raw_net_capture-*.gem                                                                            @getsentry/rails-upgrade
vendor/*/rb-fsevent-*.gem                                                                                 @getsentry/rails-upgrade
vendor/*/rb-inotify-*.gem                                                                                 @getsentry/rails-upgrade
vendor/*/recaptcha-*.gem                                                                                  @getsentry/rails-upgrade
vendor/*/redcarpet-*.gem                                                                                  @getsentry/rails-upgrade
vendor/*/redis-*.gem                                                                                      @getsentry/bolt
vendor/*/redis_concurrency_limiter-*.gem                                                                  @getsentry/bolt
vendor/*/regexp_parser-*.gem                                                                              @getsentry/rails-upgrade
vendor/*/remote_files-*.gem                                                                               @getsentry/strongbad
vendor/*/responds_to_parent-*.gem                                                                         @getsentry/rails-upgrade
vendor/*/resque-*.gem                                                                                     @getsentry/bolt
vendor/*/resque-crowd_control-*.gem                                                                       @getsentry/bolt
vendor/*/resque-disable-job-*.gem                                                                         @getsentry/bolt
vendor/*/resque-durable-*.gem                                                                             @getsentry/bolt
vendor/*/resque-lifecycle-*.gem                                                                           @getsentry/bolt
vendor/*/resque-pool-*.gem                                                                                @getsentry/bolt
vendor/*/resque-retry-*.gem                                                                               @getsentry/bolt
vendor/*/resque-scheduler-*.gem                                                                           @getsentry/bolt
vendor/*/resque-serializer-*.gem                                                                          @getsentry/narwhals @getsentry/otters
vendor/*/resque-status-*.gem                                                                              @getsentry/bolt
vendor/*/resque-throttle-*.gem                                                                            @getsentry/bolt
vendor/*/rest-client-*.gem                                                                                @getsentry/bolt
vendor/*/reverse_markdown-*.gem                                                                           @getsentry/rails-upgrade
vendor/*/rexml-*.gem                                                                                      @getsentry/rails-upgrade
vendor/*/riak-client-*.gem                                                                                @getsentry/rails-upgrade
vendor/*/rollbar-*.gem                                                                                    @getsentry/rails-upgrade
vendor/*/rotp-*.gem                                                                                       @getsentry/rails-upgrade
vendor/*/rqrcode-*.gem                                                                                    @getsentry/rails-upgrade
vendor/*/rubocop-*.gem                                                                                    @getsentry/rails-upgrade
vendor/*/rubocop-ast-*.gem                                                                                @getsentry/rails-upgrade
vendor/*/rubocop-minitest-*.gem                                                                           @getsentry/rails-upgrade
vendor/*/rubocop-performance-*.gem                                                                        @getsentry/rails-upgrade
vendor/*/rubocop-rails-*.gem                                                                              @getsentry/rails-upgrade
vendor/*/ruby-hmac-*.gem                                                                                  @getsentry/rails-upgrade
vendor/*/ruby-kafka-*.gem                                                                                 @getsentry/rails-upgrade
vendor/*/ruby-prof-*.gem                                                                                  @getsentry/rails-upgrade
vendor/*/ruby-progressbar-*.gem                                                                           @getsentry/rails-upgrade
vendor/*/ruby2_keywords-*.gem                                                                             @getsentry/rails-upgrade
vendor/*/rubyzip-*.gem                                                                                    @getsentry/rails-upgrade
vendor/*/rufus-scheduler-*.gem                                                                            @getsentry/rails-upgrade
vendor/*/rumoji-*.gem                                                                                     @getsentry/rails-upgrade
vendor/*/s3_meta_sync-*.gem                                                                               @getsentry/rails-upgrade
vendor/*/safe_regexp-*.gem                                                                                @getsentry/boxoffice @getsentry/popcorn
vendor/*/samlr-*.gem                                                                                      @getsentry/secdev @getsentry/unagi
vendor/*/samson_secret_puller-*.gem                                                                       @getsentry/rails-upgrade
vendor/*/sanitize-*.gem                                                                                   @getsentry/strongbad
vendor/*/sass-*.gem                                                                                       @getsentry/rails-upgrade
vendor/*/sass-listen-*.gem                                                                                @getsentry/rails-upgrade
vendor/*/sass-rails-*.gem                                                                                 @getsentry/rails-upgrade
vendor/*/savon-*.gem                                                                                      @getsentry/rails-upgrade
vendor/*/sawyer-*.gem                                                                                     @getsentry/rails-upgrade
vendor/*/schmobile-*.gem                                                                                  @getsentry/lir
vendor/*/scoped_cache_keys-*.gem                                                                          @getsentry/rails-upgrade
vendor/*/secure_headers-*.gem                                                                             @getsentry/rails-upgrade
vendor/*/sentry*.gem                                                                                      @getsentry/rails-upgrade @getsentry/bolt
vendor/*/sequenced-*.gem                                                                                  @getsentry/rails-upgrade
vendor/*/shoulda-change_matchers-*.gem                                                                    @getsentry/rails-upgrade
vendor/*/shoulda-matchers-*.gem                                                                           @getsentry/rails-upgrade
vendor/*/simple_access-*.gem                                                                              @getsentry/rails-upgrade
vendor/*/simple_oauth-*.gem                                                                               @getsentry/rails-upgrade
vendor/*/simplediff-ruby-*.gem                                                                            @getsentry/fang
vendor/*/sinatra-*.gem                                                                                    @getsentry/rails-upgrade
vendor/*/single_cov-*.gem                                                                                 @getsentry/rails-upgrade
vendor/*/slop-*.gem                                                                                       @getsentry/rails-upgrade
vendor/*/snappy-*.gem                                                                                     @getsentry/rails-upgrade
vendor/*/soap4r-ng-*.gem                                                                                  @getsentry/rails-upgrade
vendor/*/socksify-*.gem                                                                                   @getsentry/rails-upgrade
vendor/*/soft_deletion-*.gem                                                                              @getsentry/rails-upgrade
vendor/*/sprockets-*.gem                                                                                  @getsentry/rails-upgrade
vendor/*/sprockets-rails-*.gem                                                                            @getsentry/rails-upgrade
vendor/*/sshkit-*.gem                                                                                     @getsentry/rails-upgrade
vendor/*/stronger_parameters-*.gem                                                                        @getsentry/rails-upgrade
vendor/*/syck-*.gem                                                                                       @getsentry/bolt
vendor/*/sync-*.gem                                                                                       @getsentry/bolt
vendor/*/systemu-*.gem                                                                                    @getsentry/rails-upgrade
vendor/*/test_benchmark-*.gem                                                                             @getsentry/rails-upgrade
vendor/*/testrbl-*.gem                                                                                    @getsentry/rails-upgrade
vendor/*/thor-*.gem                                                                                       @getsentry/rails-upgrade
vendor/*/thread_safe-*.gem                                                                                @getsentry/rails-upgrade
vendor/*/ticket_sharing-*.gem                                                                             @getsentry/rails-upgrade
vendor/*/tilt-*.gem                                                                                       @getsentry/rails-upgrade
vendor/*/time_difference-*.gem                                                                            @getsentry/rails-upgrade
vendor/*/timecop-*.gem                                                                                    @getsentry/rails-upgrade
vendor/*/tinder-*.gem                                                                                     @getsentry/rails-upgrade
vendor/*/tracking_number-*.gem                                                                            @getsentry/rails-upgrade
vendor/*/turbolinks-*.gem                                                                                 @getsentry/rails-upgrade
vendor/*/twilio-ruby-*.gem                                                                                @getsentry/rails-upgrade
vendor/*/twitter*                                                                                         @getsentry/ocean
vendor/*/typhoeus-*.gem                                                                                   @getsentry/rails-upgrade
vendor/*/tzinfo-*.gem                                                                                     @getsentry/rails-upgrade
vendor/*/tzinfo-data-*.gem                                                                                @getsentry/rails-upgrade
vendor/*/ulid-*.gem                                                                                       @getsentry/ruby-core
vendor/*/ulid-rails-*.gem                                                                                 @getsentry/ruby-core
vendor/*/unf-*.gem                                                                                        @getsentry/rails-upgrade
vendor/*/unf_ext-*.gem                                                                                    @getsentry/rails-upgrade
vendor/*/unicode-display_width-*.gem                                                                      @getsentry/rails-upgrade
vendor/*/unicorn-*.gem                                                                                    @getsentry/rails-upgrade
vendor/*/unicorn_memstats-*.gem                                                                           @getsentry/bolt
vendor/*/unicorn_wrangler-*.gem                                                                           @getsentry/rails-upgrade
vendor/*/user_agent_parser-*.gem                                                                          @getsentry/secdev
vendor/*/useragent-*.gem                                                                                  @getsentry/secdev
vendor/*/uuid-*.gem                                                                                       @getsentry/rails-upgrade
vendor/*/uuidtools-*.gem                                                                                  @getsentry/rails-upgrade
vendor/*/validates_lengths_from_database-*.gem                                                            @getsentry/rails-upgrade
vendor/*/vcr-*.gem                                                                                        @getsentry/rails-upgrade
vendor/*/vegas-*.gem                                                                                      @getsentry/rails-upgrade
vendor/*/vpim-*.gem                                                                                       @getsentry/rails-upgrade
vendor/*/warden-*.gem                                                                                     @getsentry/rails-upgrade
vendor/*/wasabi-*.gem                                                                                     @getsentry/rails-upgrade
vendor/*/webmock-*.gem                                                                                    @getsentry/rails-upgrade
vendor/*/webrick-*.gem                                                                                    @getsentry/bilby
vendor/*/websocket-driver-*.gem                                                                           @getsentry/rails-upgrade
vendor/*/websocket-extensions-*.gem                                                                       @getsentry/rails-upgrade
vendor/*/will_paginate-*.gem                                                                              @getsentry/rails-upgrade
vendor/*/xml-simple-*.gem                                                                                 @getsentry/rails-upgrade
vendor/*/xmlrpc-*.gem                                                                                     @getsentry/rails-upgrade
vendor/*/yajl-ruby-*.gem                                                                                  @getsentry/rails-upgrade
vendor/*/yui-compressor-*.gem                                                                             @getsentry/rails-upgrade
vendor/*/zendesk-attachment_fu-*.gem                                                                      @getsentry/squonk
vendor/*/zendesk-rinku-*.gem                                                                              @getsentry/strongbad
vendor/*/zendesk-yam-*.gem                                                                                @getsentry/bolt
vendor/*/zendesk_api-*.gem                                                                                @getsentry/bolt
vendor/*/zendesk_api_controller-*.gem                                                                     @getsentry/bolt
vendor/*/zendesk_api_dashboard-*.gem                                                                      @getsentry/redback
vendor/*/zendesk_apm-*.gem                                                                                @getsentry/bolt @getsentry/squonk
vendor/*/zendesk_archive-*.gem                                                                            @getsentry/support-ticket-archiving
vendor/*/zendesk_arturo-*.gem                                                                             @getsentry/bolt @getsentry/squonk
vendor/*/zendesk_auth*                                                                                    @getsentry/secdev @getsentry/unagi
vendor/*/zendesk_billing_core*.gem                                                                        @getsentry/narwhals @getsentry/otters
vendor/*/zendesk_business_hours-*.gem                                                                     @getsentry/fang
vendor/*/zendesk_channels-*.gem                                                                           @getsentry/ocean
vendor/*/zendesk_classic_stats-*.gem                                                                      @getsentry/foundation-analytics-stream
vendor/*/zendesk_cldr-*.gem                                                                               @getsentry/i18n
vendor/*/zendesk_comment_markup-*.gem                                                                     @getsentry/strongbad
vendor/*/zendesk_configuration-*.gem                                                                      @getsentry/productivity-deploy @getsentry/squonk
vendor/*/zendesk_core-*.gem                                                                               @getsentry/bolt
vendor/*/zendesk_core_application-*.gem                                                                   @getsentry/bolt
vendor/*/zendesk_core_middleware-*.gem                                                                    @getsentry/bolt
vendor/*/zendesk_core_security-*.gem                                                                      @getsentry/secdev
vendor/*/zendesk_cross_origin-*.gem                                                                       @getsentry/secdev
vendor/*/zendesk_cursor_pagination-*.gem                                                                  @getsentry/boxoffice @getsentry/popcorn
vendor/*/zendesk_database_migrations-*.gem                                                                @getsentry/bolt
vendor/*/zendesk_database_support-*.gem                                                                   @getsentry/ruby-core
vendor/*/zendesk_deployment-*.gem                                                                         @getsentry/eng-productivity
vendor/*/zendesk_encryptable-*.gem                                                                        @getsentry/strongbad
vendor/*/zendesk_exceptions-*.gem                                                                         @getsentry/bolt
vendor/*/zendesk_feature_framework-*.gem                                                                  @getsentry/narwhals @getsentry/otters
vendor/*/zendesk_grpc-*.gem                                                                               @getsentry/argonauts
vendor/*/zendesk_grpc_clients-*.gem                                                                       @getsentry/argonauts
vendor/*/zendesk_health_check-*.gem                                                                       @getsentry/bolt @getsentry/squonk
vendor/*/zendesk_histogram-*.gem                                                                          @getsentry/sre
vendor/*/zendesk_i18n-*.gem                                                                               @getsentry/i18n
vendor/*/zendesk_i18n_deprecated_locale_setting_middleware-*.gem                                          @getsentry/i18n
vendor/*/zendesk_i18n_dev_tools-*.gem                                                                     @getsentry/i18n
vendor/*/zendesk_i18n_interpolation_old_style-*.gem                                                       @getsentry/i18n
vendor/*/zendesk_i18n_interpolation_sanitize-*.gem                                                        @getsentry/i18n
vendor/*/zendesk_i18n_translation_store-*.gem                                                             @getsentry/i18n
vendor/*/zendesk_i18n_translations_preloader-*.gem                                                        @getsentry/i18n
vendor/*/zendesk_i18n_yml_backend-*.gem                                                                   @getsentry/i18n
vendor/*/zendesk_internal_api_client-*.gem                                                                @getsentry/bolt
vendor/*/zendesk_ip_tools-*.gem                                                                           @getsentry/secdev
vendor/*/zendesk_jobs-*.gem                                                                               @getsentry/squonk @getsentry/bolt
vendor/*/zendesk_language_tag_matching-*.gem                                                              @getsentry/i18n
vendor/*/zendesk_logging-*.gem                                                                            @getsentry/bolt
vendor/*/zendesk_mail-*.gem                                                                               @getsentry/strongbad
vendor/*/zendesk_mobile_deeplink-*.gem                                                                    @getsentry/lir
vendor/*/zendesk_mtc_*.gem                                                                                @getsentry/strongbad
vendor/*/zendesk_oauth*                                                                                   @getsentry/secdev
vendor/*/zendesk_outgoing_mail-*.gem                                                                      @getsentry/strongbad
vendor/*/zendesk_protobuf_clients-*.gem                                                                   @getsentry/bolt @getsentry/classic-core-cph @getsentry/ticket-platform
vendor/*/zendesk_radar_client_rb-*.gem                                                                    @getsentry/radar
vendor/*/zendesk_redis*.gem                                                                               @getsentry/bolt
vendor/*/zendesk_reply_parser-*.gem                                                                       @getsentry/strongbad
vendor/*/zendesk_resque_instrumentation-*.gem                                                             @getsentry/bolt
vendor/*/zendesk_rules-*.gem                                                                              @getsentry/fang @getsentry/libretto
vendor/*/zendesk_search-*.gem                                                                             @getsentry/search
vendor/*/zendesk_shared_session-*.gem                                                                     @getsentry/secdev
vendor/*/zendesk_stats-*.gem                                                                              @getsentry/foundation-analytics-stream
vendor/*/zendesk_statsd-*.gem                                                                             @getsentry/sre
vendor/*/zendesk_system_users-*.gem                                                                       @getsentry/secdev
vendor/*/zendesk_text-*.gem                                                                               @getsentry/i18n
vendor/*/zendesk_types-*.gem                                                                              @getsentry/strongbad
vendor/*/zendesk_unique_id_migration-*.gem                                                                @getsentry/bolt
vendor/*/zendesk_voice_core-*.gem                                                                         @getsentry/voice
vendor/*/zendesk_voyager_api_client-*.gem                                                                 @getsentry/views-enablement
vendor/*/zip-zip-*.gem                                                                                    @getsentry/rails-upgrade
vendor/*/znowflake_client-*.gem                                                                           @getsentry/bolt
vendor/*/zopim_reseller_api_client-*.gem                                                                  @getsentry/narwhals @getsentry/otters
vendor/*/zstd-ruby-*.gem                                                                                  @getsentry/rails-upgrade
vendor/*/zuora_client-*.gem                                                                               @getsentry/narwhals @getsentry/otters


# Team Harrier
.bowerrc                                                                               @getsentry/harrier
.dockerignore                                                                               @getsentry/harrier
.editorconfig                                                                               @getsentry/harrier
.ember-version.example                                                                               @getsentry/harrier
.env.example                                                                               @getsentry/harrier
.eslintignore                                                                               @getsentry/harrier
.eslintrc                                                                               @getsentry/harrier
.gcloudignore                                                                               @getsentry/harrier
.github/                                                                               @getsentry/harrier
.gitignore                                                                               @getsentry/harrier
.node-version                                                                               @getsentry/harrier
.npmrc                                                                               @getsentry/harrier
.nvmrc                                                                               @getsentry/harrier
.ruby-gemset.example                                                                               @getsentry/harrier
.ruby-version                                                                               @getsentry/harrier
.watchmanconfig                                                                               @getsentry/harrier
.yarn-version                                                                               @getsentry/harrier
.yarn/                                                                               @getsentry/harrier
.yarnrc                                                                               @getsentry/harrier
/Capfile                                                                               @getsentry/harrier
/Deploy.md                                                                               @getsentry/harrier
/Deploy-Spinnaker.md                                                                               @getsentry/harrier
/CONTRIBUTING.md                                                                               @getsentry/harrier
/Dockerfile                                                                               @getsentry/harrier
/Dockerfile.cypress                                                                               @getsentry/harrier
/Dockerfile.lotus_deploy                                                                               @getsentry/harrier
/Gemfile                                                                               @getsentry/harrier
/Gemfile.lock                                                                               @getsentry/harrier
/nginx.conf                                                                               @getsentry/harrier
/Procfile                                                                               @getsentry/harrier
/README.md                                                                               @getsentry/harrier
/Rakefile                                                                               @getsentry/harrier
/app/assets/javascripts/components/dataTestIds.module.js                                                                               @getsentry/harrier
/app/assets/javascripts/models/dataTestIds.module.js                                                                               @getsentry/harrier
/app/assets/javascripts/views/modals/dataTestIds.module.js                                                                               @getsentry/harrier
/app/assets/javascripts/views/users/dataTestIds.module.js                                                                               @getsentry/harrier
/app/assets/javascripts/views/organizations/dataTestIds.module.js                                                                               @getsentry/harrier
/app/assets/javascripts/views/section_toolbar/dataTestIds.module.js                                                                               @getsentry/harrier
/app/assets/javascripts/views/tickets/dataTestIds.module.js                                                                               @getsentry/harrier
/activities/user/javascripts/views/users/identities/dataTestIds.module.js                                                                               @getsentry/harrier
/activities/admin/javascripts/controllers/admin/dataTestIds.module.js                                                                               @getsentry/harrier
/app/assets/javascripts/controllers/ticket_controller/dataTestIds.module.js                                                                               @getsentry/harrier
/app/assets/javascripts/controllers/dataTestIds.module.js                                                                               @getsentry/harrier
/app/assets/javascripts/views/tickets/comments/dataTestIds.module.js                                                                               @getsentry/harrier
/app/assets/javascripts/views/tickets/ticket_fields/dataTestIds.module.js                                                                               @getsentry/harrier
/app/assets/javascripts/components/ticket_audit/dataTestIds.module.js                                                                               @getsentry/harrier
/app/assets/javascripts/components/react_component.module.js                                                                               @getsentry/harrier
/app/assets/javascripts/components/react_partial_credit_card.module.js                                                                               @getsentry/harrier
/app/assets/javascripts/initializers/                                                                               @getsentry/harrier
/app/assets/javascripts/lib/boot_features.module.js                                                                               @getsentry/harrier
/app/assets/javascripts/lib/browser_detection.module.js                                                                               @getsentry/harrier
/app/assets/javascripts/lib/default_features.module.js                                                                               @getsentry/harrier
/app/assets/javascripts/lib/growl.module.js                                                                               @getsentry/harrier                                                                               @getsentry/polo
/app/assets/javascripts/lib/growl/old_growl.module.js                                                                               @getsentry/harrier
/app/assets/javascripts/lib/monitoring/                                                                               @getsentry/harrier
/app/assets/javascripts/lib/reactTicketEvents.module.js                                                                               @getsentry/harrier
/app/assets/javascripts/lib/reactViewEvents.module.js                                                                               @getsentry/harrier
/app/assets/javascripts/lib/telemetry.module.js                                                                               @getsentry/harrier
/app/assets/javascripts/mixins/resource/graphql_resource.module.js                                                                               @getsentry/harrier
/app/assets/javascripts/mixins/react_plug.module.js                                                                               @getsentry/harrier
/app/assets/javascripts/models/ticket/react_ticket.module.js                                                                               @getsentry/harrier
/app/assets/javascripts/models/ticket/react_fields.module.js                                                                               @getsentry/harrier
/app/assets/javascripts/models/ticket/react_conversation.module.js                                                                               @getsentry/harrier
/app/assets/javascripts/post_initializers/warn_for_nearly_incompatible_browsers.module.js                                                                               @getsentry/harrier
/app/assets/javascripts/services/bootTaskRecorder.module.js                                                                               @getsentry/harrier
/app/assets/javascripts/templates/lib/date.js.hdbs                                                                               @getsentry/harrier
/app/assets/javascripts/templates/main_pane/                                                                               @getsentry/harrier
/app/assets/javascripts/templates/main_pane/user_filters.js.hdbs                                                                               @getsentry/penguin
/app/assets/javascripts/templates/performance.js.hdbs                                                                               @getsentry/harrier
/app/assets/javascripts/templates/tickets/ticket_fields/react/                                                                               @getsentry/harrier
/app/assets/javascripts/templates/tickets/react_audits_view.js.hdbs                                                                               @getsentry/harrier
/app/assets/javascripts/views/nav_bar/dataTestIds.module.js                                                                               @getsentry/harrier
/app/assets/javascripts/views/performance_view.module.js                                                                               @getsentry/harrier
/app/assets/javascripts/views/tickets/ticket_fields/form_field_test_id_mixin.module.js                                                                               @getsentry/harrier
/app/assets/javascripts/views/tickets/ticket_fields/react/                                                                               @getsentry/harrier
/app/assets/javascripts/views/tickets/ticket_fields/multiline_view.module.js                                                                               @getsentry/harrier
/app/assets/javascripts/views/tickets/ticket_fields/ticket_id_as_string_mixin.module.js                                                                               @getsentry/harrier
/app/assets/javascripts/views/tickets/ticket_fields/ticket_validate_workspace.module.js                                                                               @getsentry/harrier
/app/assets/javascripts/views/tickets/ticket_fields/system_field_test_id_mixin.module.js                                                                               @getsentry/harrier
/app/assets/javascripts/views/tickets/react_audits_view.module.js                                                                               @getsentry/harrier
/activities/filters/javascripts/templates/filters/views_list_with_react.js.hdbs                                                                               @getsentry/harrier
/activities/filters/javascripts/views/filters/views_list_with_react.module.js                                                                               @getsentry/harrier
/bower.json                                                                               @getsentry/harrier
/broccoli/                                                                               @getsentry/harrier
/config.ru                                                                               @getsentry/harrier
/config/                                                                               @getsentry/harrier
/config/lotus.json.example                                                                               @getsentry/harrier
/docs/                                                                               @getsentry/harrier
/doctoc-files.txt                                                                               @getsentry/harrier
/ember-cli-build.js                                                                               @getsentry/harrier
/kubernetes/                                                                               @getsentry/harrier
/lib/lotus                                                                               @getsentry/harrier
/lib/middleware/broccoli_assets.rb                                                                               @getsentry/harrier
/lib/tasks/                                                                               @getsentry/harrier
/lotus_react/.browserslistrc                                                                               @getsentry/harrier
/lotus_react/.eslintignore                                                                               @getsentry/harrier
/lotus_react/.eslintrc.d.ts                                                                               @getsentry/harrier
/lotus_react/.eslintrc.js                                                                               @getsentry/harrier
/lotus_react/compat.eslintrc.js                                                                               @getsentry/harrier
/lotus_react/.hygen.js                                                                               @getsentry/harrier
/lotus_react/.prettierignore                                                                               @getsentry/harrier
/lotus_react/.prettierrc                                                                               @getsentry/harrier
/lotus_react/.yarnrc                                                                               @getsentry/harrier
/lotus_react/.graphqlconfig                                                                               @getsentry/harrier
/lotus_react/bundlesize.config.json                                                                               @getsentry/harrier
/lotus_react/cypress/fixtures                                                                               @getsentry/harrier
/lotus_react/cypress/help                                                                               @getsentry/harrier
/lotus_react/cypress/plugins                                                                               @getsentry/harrier
/lotus_react/cypress/support                                                                               @getsentry/harrier
/lotus_react/cypress/.eslintrc.js                                                                               @getsentry/harrier
/lotus_react/cypress/README.md                                                                               @getsentry/harrier
/lotus_react/cypress/tsconfig.json                                                                               @getsentry/harrier
/lotus_react/cypress/tsconfigForESLint.json                                                                               @getsentry/harrier
/lotus_react/cypress.json                                                                               @getsentry/harrier
/lotus_react/cypress-codecov.json                                                                               @getsentry/harrier
/lotus_react/cypress.env.example.json                                                                               @getsentry/harrier
/lotus_react/cypress/integration/pageTitles/                                                                               @getsentry/harrier
/lotus_react/cypress/integration/ticket/bulkedit/bulkeditember.spec.js                                                                               @getsentry/harrier
/lotus_react/cypress/integration/ticket/form/fields.spec.js                                                                               @getsentry/harrier
/lotus_react/cypress/integration/ticket/incidents/incidentsTable.spec.ts                                                                               @getsentry/harrier
/lotus_react/CODE_STYLE_IGNORES                                                                               @getsentry/harrier
/lotus_react/README.md                                                                               @getsentry/harrier
/lotus_react/codecov.yml                                                                               @getsentry/harrier
/lotus_react/config/                                                                               @getsentry/harrier
/lotus_react/config/hygen/omnilog-event                                                                               @getsentry/hibiscus
/lotus_react/docs/                                                                               @getsentry/harrier
/lotus_react/eslint-local-rules.js                                                                               @getsentry/harrier
/lotus_react/jsconfig.json                                                                               @getsentry/harrier
/lotus_react/package.json                                                                               @getsentry/harrier
/lotus_react/scripts/                                                                               @getsentry/harrier
/lotus_react/src/__tests__/                                                                               @getsentry/harrier
/lotus_react/src/Admin/state/                                                                               @getsentry/harrier
/lotus_react/src/Admin/MobileSDK/                                                                               @getsentry/harrier
/lotus_react/src/app/                                                                               @getsentry/harrier
/lotus_react/src/componentPreloader.js                                                                               @getsentry/harrier
/lotus_react/src/CommonProviders/                                                                               @getsentry/harrier
/lotus_react/src/globalStyles.js                                                                               @getsentry/harrier
/lotus_react/src/Chat/.eslintrc.js                                                                               @getsentry/harrier
/lotus_react/src/Growl/                                                                               @getsentry/harrier
/lotus_react/src/LazyLoad/                                                                               @getsentry/harrier
/lotus_react/src/README.md                                                                               @getsentry/harrier
/lotus_react/src/Outlet/                                                                               @getsentry/harrier
/lotus_react/src/SideConversations/.eslintrc.js                                                                               @getsentry/harrier
/lotus_react/src/Toolbar/FeatureToggleMenu                                                                               @getsentry/harrier
/lotus_react/src/Ticket/data/                                                                               @getsentry/harrier
/lotus_react/src/Ticket/hooks/                                                                               @getsentry/harrier
/lotus_react/src/Ticket/LegacyConversationPane/                                                                               @getsentry/harrier
/lotus_react/src/Ticket/Footer/SubmitButton                                                                               @getsentry/harrier
/lotus_react/cypress/integration/ticket/ticketSubmitOptions.spec.js                                                                               @getsentry/harrier
/lotus_react/src/components                                                                               @getsentry/harrier
/lotus_react/src/emberApi/                                                                               @getsentry/harrier
/lotus_react/src/printDevInfo.ts                                                                               @getsentry/harrier
/lotus_react/src/cypressGlobals.ts                                                                               @getsentry/harrier
/lotus_react/src/index.js                                                                               @getsentry/harrier
/lotus_react/src/lib/                                                                               @getsentry/harrier
/lotus_react/src/shared-ui/                                                                               @getsentry/harrier
/lotus_react/src/state/                                                                               @getsentry/harrier
/lotus_react/src/types/gql                                                                               @getsentry/harrier
/lotus_react/src/typescriptHelp.ts                                                                               @getsentry/harrier
/lotus_react/src/utilities/                                                                               @getsentry/harrier
/lotus_react/src/utils/                                                                               @getsentry/harrier
/lotus_react/tsconfig.json                                                                               @getsentry/harrier
/lotus_react/yarn.lock                                                                               @getsentry/harrier
/jsconfig.json                                                                               @getsentry/harrier
/package.json                                                                               @getsentry/harrier
/precompile                                                                               @getsentry/harrier
/public/agent/version.json                                                                               @getsentry/harrier
/script/                                                                               @getsentry/harrier
/service.yml                                                                               @getsentry/harrier
/test/unit/lotus                                                                               @getsentry/harrier
/test/i18n/validate_yml.rb                                                                               @getsentry/harrier
/vendor/assets/                                                                               @getsentry/harrier
/unowned-files.txt                                                                               @getsentry/harrier
/yarn.lock                                                                               @getsentry/harrier
/lotus_react/src/Chrome/MainNavigation/                                                                               @getsentry/harrier
/lotus_react/cypress/integration/Chrome/MainNavigation/                                                                               @getsentry/harrier
/lotus_react/src/Ticket/TicketPropertiesSidebar                                                                               @getsentry/harrier
/lotus_react/src/Ticket/TicketPropertiesSidebar/index.js                                                                               @getsentry/harrier
/lotus_react/src/Ticket/TicketPropertiesSidebar/README.md                                                                               @getsentry/harrier
/lotus_react/src/Ticket/TicketPropertiesSidebar/stories.js                                                                               @getsentry/harrier
/lotus_react/src/Ticket/state/                                                                               @getsentry/harrier
/lotus_react/src/Ticket/                                                                               @getsentry/harrier
/lotus_react/src/Toolbar/ProfileMenu                                                                               @getsentry/harrier                                                                               @getsentry/lavender
/lotus_react/__mocks__/popper.js.js                                                                               @getsentry/harrier
/lotus_react/src/index.d.ts                                                                               @getsentry/harrier
/lotus_react/src/styles.d.ts                                                                               @getsentry/harrier
/spinnaker/applications/lotus.json                                                                               @getsentry/harrier
activities/filters/javascripts/controllers/tickets_views_controller.module.js                                                                               @getsentry/harrier
/lotus_react/src/components/TableV2                                                                               @getsentry/harrier

# Team Osprey
/lotus_react/src/types/drag-drop.d.ts                                                                               @getsentry/osprey
/lotus_react/cypress/integration/ticket/systemFields                                                                               @getsentry/osprey
/lotus_react/src/Chrome/TopBar                                                                               @getsentry/osprey
/lotus_react/src/Toolbar/index.d.ts                                                                               @getsentry/osprey
/lotus_react/cypress/integration/ticket/incidents/openTicket.spec.ts                                                                               @getsentry/osprey
/lotus_react/cypress/integration/ticket/newTicketActionsOnSave.spec.js                                                                               @getsentry/osprey
/lotus_react/cypress/integration/ticket/newTicketPillboxNav.spec.js                                                                               @getsentry/osprey
/lotus_react/cypress/integration/ticket/ticketAssignFromComments.spec.js                                                                               @getsentry/osprey
/lotus_react/cypress/integration/ticket/ticketDirectNavigation.spec.js                                                                               @getsentry/osprey
/lotus_react/cypress/integration/ticket/ticketProbIncidentLink.spec.js                                                                               @getsentry/osprey
/lotus_react/cypress/integration/ticket/ticketProbIncidentSolve.spec.js                                                                               @getsentry/osprey
/lotus_react/src/utils/switchFn.ts                                                                               @getsentry/pingu
/lotus_react/src/utils/__tests__/switchFn.test.ts                                                                               @getsentry/pingu
/lotus_react/src/utils/componentTiming/                                                                               @getsentry/pingu
/lotus_react/src/utils/realUserMonitoring.ts                                                                               @getsentry/pingu                                                                               @getsentry/harrier
/lotus_react/src/utils/__tests__/realUserMonitoring.ts                                                                               @getsentry/pingu                                                                               @getsentry/harrier
/lotus_react/src/utils/logging/                                                                               @getsentry/pingu                                                                               @getsentry/harrier
/lotus_react/src/utils/monitoring/                                                                               @getsentry/pingu                                                                               @getsentry/harrier
/lotus_react/src/utils/pascalCase.ts                                                                               @getsentry/pingu                                                                               @getsentry/harrier
/lotus_react/src/utils/__tests__/pascalCase.test.ts                                                                               @getsentry/pingu                                                                               @getsentry/harrier
/lotus_react/src/utils/errorReporting.ts                                                                               @getsentry/pingu                                                                               @getsentry/harrier
/lotus_react/src/utils/reportApolloError.ts                                                                               @getsentry/pingu                                                                               @getsentry/harrier
/lotus_react/src/utils/sentryReporter.ts                                                                               @getsentry/pingu                                                                               @getsentry/harrier
/lotus_react/src/utils/sentry/                                                                               @getsentry/pingu                                                                               @getsentry/harrier
.github/workflows/ui-tests.yml                                                                               @getsentry/pingu                                                                               @getsentry/harrier

# Ghostbusters (Pingu and Falcon)
.github/workflows/ghostbusters.yml                                                                               @getsentry/pingu                                                                               @getsentry/harrier
/lotus_react/ghostbusters/actions/lotus/click-accept-chat-button.ts                                                                               @getsentry/pingu                                                                               @getsentry/falcon
/lotus_react/ghostbusters/actions/lotus/close-all-modals.ts                                                                               @getsentry/pingu
/lotus_react/ghostbusters/actions/lotus/get-ticket-row-link-in-dashboard-table.ts                                                                               @getsentry/pingu
/lotus_react/ghostbusters/actions/lotus/go-to-home.ts                                                                               @getsentry/pingu
/lotus_react/ghostbusters/actions/lotus/index.ts                                                                               @getsentry/pingu
/lotus_react/ghostbusters/actions/lotus/login.ts                                                                               @getsentry/pingu
/lotus_react/ghostbusters/actions/lotus/logout.ts                                                                               @getsentry/pingu
/lotus_react/ghostbusters/actions/lotus/notifications.ts                                                                               @getsentry/pingu
/lotus_react/ghostbusters/actions/lotus/open-ticket.ts                                                                               @getsentry/pingu
/lotus_react/ghostbusters/actions/lotus/set-chat-status.ts                                                                               @getsentry/pingu
/lotus_react/ghostbusters/actions/lotus/sort-dashboard-ticket-table.ts                                                                               @getsentry/pingu
/lotus_react/ghostbusters/actions/lotus/tabs.ts                                                                               @getsentry/pingu
/lotus_react/ghostbusters/clients/chatVisitorClient.ts                                                                               @getsentry/falcon
/lotus_react/ghostbusters/clients/DataNode.ts                                                                               @getsentry/falcon
/lotus_react/ghostbusters/clients/webioClient.ts                                                                               @getsentry/falcon
/lotus_react/ghostbusters/clients/webSocketClient.ts                                                                               @getsentry/falcon
/lotus_react/ghostbusters/scenarios/lighthouse-assertions.ts                                                                               @getsentry/pingu
/lotus_react/ghostbusters/scenarios/accept-chat.ts                                                                               @getsentry/pingu                                                                               @getsentry/falcon
/lotus_react/ghostbusters/scenarios/open-ticket.ts                                                                               @getsentry/pingu                                                                               @getsentry/falcon
/lotus_react/ghostbusters/scenarios/open-ticket-multiple.ts                                                                               @getsentry/pingu                                                                               @getsentry/falcon
/lotus_react/ghostbusters/scenarios/switch-chat-tab.ts                                                                               @getsentry/pingu                                                                               @getsentry/falcon
/lotus_react/ghostbusters/scenarios/switch-ticket-tab.ts                                                                               @getsentry/pingu                                                                               @getsentry/falcon
/lotus_react/ghostbusters/types/types.ts                                                                               @getsentry/pingu
/lotus_react/ghostbusters/utils/assert.ts                                                                               @getsentry/pingu
/lotus_react/ghostbusters/utils/click.ts                                                                               @getsentry/pingu
/lotus_react/ghostbusters/utils/dataTestId.ts                                                                               @getsentry/pingu
/lotus_react/ghostbusters/utils/defineLotusRequirements.ts                                                                               @getsentry/pingu
/lotus_react/ghostbusters/utils/falconPerformanceMetrics.ts                                                                               @getsentry/falcon
/lotus_react/ghostbusters/utils/makePromise.ts                                                                               @getsentry/pingu
/lotus_react/ghostbusters/utils/waitForNextPerformanceTiming.ts                                                                               @getsentry/pingu
/lotus_react/ghostbusters/utils/simulateVisitors.ts                                                                               @getsentry/pingu                                                                               @getsentry/falcon
/lotus_react/ghostbusters/utils/ticketsApi.ts                                                                               @getsentry/pingu
/lotus_react/ghostbusters/utils/waitForNetworkIdle.js                                                                               @getsentry/pingu
/lotus_react/ghostbusters/utils/waitForOmniLogVisible.ts                                                                               @getsentry/pingu
/lotus_react/ghostbusters/utils/zendeskApiFetch.ts                                                                               @getsentry/pingu
/lotus_react/ghostbusters/tsconfig.json                                                                               @getsentry/pingu

# Team Kookaburra - App Framework Support Integration
/activities/app_framework/                                                                               @getsentry/kookaburra
/app/assets/javascripts/routes/apps.module.js                                                                               @getsentry/kookaburra
/app/assets/javascripts/routes/apps/                                                                               @getsentry/kookaburra
/app/assets/javascripts/controllers/apps_controller.module.js                                                                               @getsentry/kookaburra
/app/assets/javascripts/initializers/app_framework.module.js                                                                               @getsentry/kookaburra
/app/assets/javascripts/lib/apps/                                                                               @getsentry/kookaburra
/app/assets/images/glyphicons-halflings-white.png                                                                               @getsentry/kookaburra
/app/assets/images/glyphicons-halflings.png                                                                               @getsentry/kookaburra
/app/assets/javascripts/views/apps/app_container_host.module.js                                                                               @getsentry/kookaburra
/spec/javascripts/views/apps/app_container_host_spec.js                                                                               @getsentry/kookaburra
/spec/javascripts/spec_helpers/app_framework_helper.js                                                                               @getsentry/kookaburra
/lotus_react/docs/app-framework-support-integration/                                                                               @getsentry/kookaburra
/lotus_react/src/AppFramework/                                                                               @getsentry/kookaburra
/lotus_react/cypress/integration/appFramework/                                                                               @getsentry/kookaburra
/lotus_react/cypress/support/interactions/apps                                                                               @getsentry/kookaburra
/lotus_react/cypress/support/utils/apps                                                                               @getsentry/kookaburra
/lotus_react/cypress/support/commands/iframe.js                                                                               @getsentry/kookaburra
/lotus_react/src/Chrome/NavBarAppContainer                                                                               @getsentry/kookaburra
/lotus_react/src/Organization/AppSidebar                                                                               @getsentry/kookaburra
/lotus_react/src/Ticket/AppSidebar/                                                                               @getsentry/kookaburra
/app/assets/javascripts/mixins/apps_react_ticket_sidebar.module.js                                                                               @getsentry/kookaburra
/app/assets/javascripts/controllers/ticket_controller/redux_assignee_options.module.js                                                                               @getsentry/kookaburra
/spec/javascripts/controllers/ticket_controller/redux_assignee_options_spec.js                                                                               @getsentry/kookaburra
/app/assets/javascripts/controllers/ticket_controller/react_agent_interface_features.module.js                                                                               @getsentry/kookaburra                                                                               @getsentry/boxoffice                                                                               @getsentry/orchid
/app/assets/javascripts/mixins/toggleable_features_consumer.module.js                                                                               @getsentry/kookaburra                                                                               @getsentry/harrier
/app/assets/javascripts/services/toggleable_features_service.module.js                                                                               @getsentry/kookaburra                                                                               @getsentry/harrier
/spec/javascripts/services/toggleable_features_service_spec.js                                                                               @getsentry/kookaburra                                                                               @getsentry/harrier
/lotus_react/src/utils/hooks/useIntersectionObserver.ts                                                                               @getsentry/kookaburra
/lotus_react/src/utils/hooks/__tests__/useIntersectionObserver.test.ts                                                                               @getsentry/kookaburra
/lotus_react/src/components/Defer/                                                                               @getsentry/kookaburra

# Team Kingfisher
/activities/admin/javascripts/templates/admin/contextual_workspaces.js.hdbs                                                                               @getsentry/kingfisher
/activities/admin/javascripts/views/admin/contextual_workspaces_view.module.js                                                                               @getsentry/kingfisher
/app/assets/javascripts/mixins/ipm_alert_mixin.module.js                                                                               @getsentry/kingfisher
/app/assets/javascripts/models/contextual_workspaces.module.js                                                                               @getsentry/kingfisher
/app/assets/javascripts/views/tickets/ticket_fields/ticket_fields_grid_layout_expanded_width.module.js                                                                               @getsentry/kingfisher
/spec/javascripts/models/contextual_workspaces_spec.js                                                                               @getsentry/kingfisher
/lotus_react/cypress/integration/ticket/flexibleLayouts/                                                                               @getsentry/kingfisher
/lotus_react/cypress/integration/omnipanel                                                                               @getsentry/kingfisher
/lotus_react/src/Admin/ContextualWorkspaces/                                                                               @getsentry/kingfisher
/lotus_react/src/Onboarding/FlexibleLayout/                                                                               @getsentry/kingfisher
/lotus_react/src/Onboarding/hooks/__tests__/useUserSettingsMutation.test.js                                                                               @getsentry/kingfisher
/lotus_react/src/Onboarding/hooks/useUserSettingsMutation.ts                                                                               @getsentry/kingfisher
/lotus_react/src/state/layout/                                                                               @getsentry/kingfisher
/lotus_react/src/Ticket/FlexibleLayout/                                                                               @getsentry/kingfisher
/lotus_react/src/Ticket/NextTicketButton/                                                                               @getsentry/kingfisher
/activities/admin/javascripts/templates/admin/context_panel.js.hdbs                                                                               @getsentry/kingfisher
/app/assets/javascripts/routes/admin/context_panel.module.js                                                                               @getsentry/kingfisher
/lotus_react/src/Admin/ContextPanel/                                                                               @getsentry/kingfisher
/lotus_react/src/Omnipanel                                                                               @getsentry/kingfisher # Polaris Shared
/app/assets/javascripts/lib/growl/new_growl.module.js                                                                               @getsentry/polo
/app/assets/javascripts/components/comment_rich_text_editor.module.js                                                                               @getsentry/hibiscus                                                                               @getsentry/strongbad
/app/assets/javascripts/models/audits/chat_ended_event_parser.module.js                                                                               @getsentry/polo
/app/assets/javascripts/models/audits/chat_ended_attachment_parser.module.js                                                                               @getsentry/polo
/app/assets/javascripts/models/audits/chat_started_event_parser.module.js                                                                               @getsentry/polo
/app/assets/javascripts/models/user/types.module.js                                                                               @getsentry/polo
/app/assets/javascripts/lib/omnichannel.module.js                                                                               @getsentry/hibiscus                                                                               @getsentry/polo
/app/assets/javascripts/templates/tickets/pane/polaris_conversation.js.hdbs                                                                               @getsentry/orchid                                                                               @getsentry/hibiscus                                                                               @getsentry/polo
/lotus_react/src/Ticket/ConversationPane                                                                               @getsentry/polo                                                                               @getsentry/hibiscus
/lotus_react/src/Ticket/ConversationPane/components/OmniLog/data                                                                               @getsentry/polo                                                                               @getsentry/hibiscus                                                                               @getsentry/harrier
/lotus_react/src/Ticket/ConversationPane/components/OnboardingContainer                                                                               @getsentry/polo                                                                               @getsentry/ponderosa
/lotus_react/src/Ticket/ConversationPane/components/OmniLog/constants.js                                                                               @getsentry/hibiscus                                                                               @getsentry/groot                                                                               @getsentry/squonk
/lotus_react/src/Omnipanel/components/OmnipanelPrechatFormDiscrepancySwitcher                                                                               @getsentry/polo
/lotus_react/src/components/JumpButton                                                                               @getsentry/hibiscus                                                                               @getsentry/polo
/lotus_react/src/Ticket/Customer/components/UserProfile/__tests__/UserProfile.test.js                                                                               @getsentry/polo                                                                               @getsentry/echidna
/lotus_react/src/Chat                                                                               @getsentry/polo
/lotus_react/src/Chat/data                                                                               @getsentry/polo
/lotus_react/src/Chat/data/conversation/useConversation.js                                                                               @getsentry/polo                                                                               @getsentry/snoop
/lotus_react/src/Chat/data/conversation/__tests__/useConversation.test.js                                                                               @getsentry/polo                                                                               @getsentry/snoop
/lotus_react/src/Chat/data/conversation/useSocialMessagingSessionRestore.js                                                                               @getsentry/snoop
/lotus_react/src/Chat/data/conversation/__tests__/useSocialMessagingSessionRestore.test.js                                                                               @getsentry/snoop
/lotus_react/src/Chat/__fixtures__/sendChatMessageToIssueMutation.json                                                                               @getsentry/snoop
/lotus_react/src/Chat/data/__tests__/sendChatMessageToIssue.test.js                                                                               @getsentry/snoop
/lotus_react/src/Chat/data/conversation/__fixtures__/eventSubscriptionByIssueId.json                                                                               @getsentry/snoop
/lotus_react/src/Chat/data/conversation/__fixtures__/issueStateSubscription.json                                                                               @getsentry/snoop
/lotus_react/src/Chat/data/conversation/gql/eventByIssueIdSubscription.gql                                                                               @getsentry/snoop
/lotus_react/src/Chat/data/conversation/gql/issueChatStateSubscription.gql                                                                               @getsentry/snoop
/lotus_react/src/Chat/data/conversation/messagingConversationService.js                                                                               @getsentry/snoop
/lotus_react/src/Chat/data/mutation/sendMessageToIssueMutation.gql                                                                               @getsentry/snoop
/lotus_react/src/Chat/data/sendChatMessageToIssue.js                                                                               @getsentry/snoop
/lotus_react/src/Chat/data/sendAttachmentsToIssue.js                                                                               @getsentry/snoop
/lotus_react/cypress/integration/chat/accept_chat.spec.js                                                                               @getsentry/polo                                                                               @getsentry/snoop
/spec/javascripts/models/audits/chat_ended_attachment_parser_spec.js                                                                               @getsentry/polo
/app/assets/javascripts/helpers/coerceIdToString.module.js                                                                               @getsentry/harrier                                                                               @getsentry/polo
/lotus_react/src/utils/hooks/usePopoverMutex                                                                               @getsentry/polo
/lotus_react/src/utils/hooks/useWindowFocus                                                                               @getsentry/polo                                                                               @getsentry/falcon
/lotus_react/src/utils/shorthand.js                                                                               @getsentry/polo

# Team Hibiscus
/activities/app_framework/javascripts/views/ticket_editor/                                                                               @getsentry/hibiscus
/app/assets/javascripts/controllers/ticket_controller/comments_scroll_mixin.module.js                                                                               @getsentry/hibiscus
/app/assets/javascripts/controllers/ticket_controller/comment_over_limit.module.js                                                                               @getsentry/hibiscus
/app/assets/javascripts/controllers/editor_tabs_controller.module.js                                                                               @getsentry/hibiscus
/app/assets/javascripts/controllers/deliverable_email_controller.module.js                                                                               @getsentry/hibiscus
/app/assets/javascripts/controllers/email_ccs_controller.module.js                                                                               @getsentry/hibiscus
/app/assets/javascripts/lib/views/combobox_patch.module.js                                                                               @getsentry/hibiscus
/app/assets/javascripts/lib/utils/simple_emitter.module.js                                                                               @getsentry/hibiscus
/app/assets/javascripts/templates/components/comment_rich_text_editor.js.hdbs                                                                               @getsentry/hibiscus
/app/assets/javascripts/templates/tickets/pane/omnichannel.js.hdbs                                                                               @getsentry/hibiscus
/app/assets/javascripts/templates/tickets/add_comment/react_shared_content.js.hdbs                                                                               @getsentry/hibiscus
/app/assets/javascripts/templates/tickets/pane/new_agent_workspace.js.hdbs                                                                               @getsentry/hibiscus
/app/assets/javascripts/views/tickets/editor_container.module.js                                                                               @getsentry/hibiscus
/spec/javascripts/controllers/deliverable_email_controller_spec.js                                                                               @getsentry/hibiscus
/spec/javascripts/controllers/editor_tabs_controller_spec.js                                                                               @getsentry/hibiscus
/spec/javascripts/lib/newline_converter_spec.js                                                                               @getsentry/hibiscus
/lotus_react/cypress/integration/omnicomposer                                                                               @getsentry/hibiscus
/lotus_react/cypress/integration/standaloneEditor                                                                               @getsentry/hibiscus
/lotus_react/cypress/integration/ticket/ticketExistingAttachment.spec.js                                                                               @getsentry/hibiscus
/lotus_react/cypress/integration/ticket/ticketAttachment.spec.js                                                                               @getsentry/hibiscus
/lotus_react/cypress/integration/ticket/ticketComment.spec.js                                                                               @getsentry/hibiscus
/lotus_react/cypress/integration/ticket/ticketCommentCache.spec.js                                                                               @getsentry/hibiscus
/lotus_react/cypress/integration/ticket/ticketCommentCheck.spec.js                                                                               @getsentry/hibiscus
/lotus_react/cypress/integration/ticket/ticketInfo.spec.js                                                                               @getsentry/hibiscus                                                                               @getsentry/iris                                                                               @getsentry/boxoffice
/lotus_react/src/Editor/                                                                               @getsentry/hibiscus
/lotus_react/src/components/AttachmentThumbnails/                                                                               @getsentry/hibiscus
/lotus_react/src/components/EditorAttachments/                                                                               @getsentry/hibiscus
/lotus_react/src/components/PlainOrRichTextEditor/                                                                               @getsentry/hibiscus
/lotus_react/src/Ticket/ChatComposer/                                                                               @getsentry/hibiscus
/lotus_react/src/Ticket/ConversationPane/OmniConversationPane.js                                                                               @getsentry/hibiscus
/lotus_react/src/Ticket/ConversationPane/components/OmniComposer                                                                               @getsentry/hibiscus
/lotus_react/src/Ticket/ConversationPane/components/ResizableView                                                                               @getsentry/hibiscus
/lotus_react/src/Ticket/ConversationPane/components/OmniLog                                                                               @getsentry/hibiscus
/lotus_react/src/Ticket/ConversationPane/components/PhishingTicketAlert                                                                               @getsentry/hibiscus
/lotus_react/src/Ticket/ConversationPane/components/OmniLog/components/ConversationLog/components/Comment/components/PhishingAlerts                                                                               @getsentry/hibiscus
/lotus_react/src/Ticket/ConversationPane/reducer                                                                               @getsentry/hibiscus
/lotus_react/src/Ticket/ConversationPane/hooks/useComposerCollapseManager.js                                                                               @getsentry/hibiscus
/lotus_react/src/Ticket/RichTextEditor                                                                               @getsentry/hibiscus
/lotus_react/src/types/zendesk/linkify.d.ts                                                                               @getsentry/hibiscus
/lotus_react/src/utils/deserializeWithEmojiSpans.js                                                                               @getsentry/hibiscus
/lotus_react/src/utils/__tests__/deserializeWithEmojiSpans.test.js                                                                               @getsentry/hibiscus
/app/assets/javascripts/views/modals/dataTestIds.module.js                                                                               @getsentry/hibiscus
/lotus_react/src/Ticket/Redaction/                                                                               @getsentry/orchid
/lotus_react/cypress/integration/omniredaction                                                                               @getsentry/orchid
/lotus_react/cypress/integration/omnilog                                                                               @getsentry/hibiscus
/lotus_react/src/Attachment/                                                                               @getsentry/hibiscus
/lotus_react/cypress/integration/ticket/ticketAttachmentWithMalware.spec.ts                                                                               @getsentry/hibiscus
/lotus_react/cypress/integration/ticket/ticketCommentFormatting.spec.js                                                                               @getsentry/hibiscus
/lotus_react/cypress/integration/ticket/ticketCreate.spec.js                                                                               @getsentry/hibiscus                                                                               @getsentry/iris                                                                               @getsentry/boxoffice
/lotus_react/cypress/integration/ticket/ticketCreateAsMacro.spec.js                                                                               @getsentry/hibiscus
/lotus_react/cypress/integration/ticket/ticketOptions.spec.js                                                                               @getsentry/hibiscus

# Team Lavender
/lotus_react/cypress/integration/statusSwitcher/                                                                               @getsentry/lavender
/app/assets/javascripts/post_initializers/unified_agent_status_notifications.module.js                                                                               @getsentry/lavender
/spec/javascripts/post_initializers/unified_agent_status_notifications_spec.js                                                                               @getsentry/lavender

# Team Orchid
/activities/filters/javascripts/templates/filters/ticket_list_with_react.js.hdbs                                                                               @getsentry/orchid
/activities/filters/javascripts/views/filters/filter_content_view_with_react.module.js                                                                               @getsentry/orchid
/activities/filters/javascripts/views/filters/ticket_list_view_with_react.module.js                                                                               @getsentry/orchid
/activities/filters/javascripts/models/filter/search_api_filter_ticket_parser.module.js                                                                               @getsentry/orchid
/activities/filters/javascripts/models/filter/search_based_ticket_filter.module.js                                                                               @getsentry/orchid
/app/assets/javascripts/components/tabs                                                                               @getsentry/orchid
/app/assets/javascripts/components/tabs_basic.module.js                                                                               @getsentry/orchid
/app/assets/javascripts/components/tabs_functional.module.js                                                                               @getsentry/orchid
/app/assets/javascripts/components/workspace_tabs.module.js                                                                               @getsentry/orchid
/app/assets/javascripts/controllers/add_tab_controller.module.js                                                                               @getsentry/orchid
/app/assets/javascripts/controllers/header_controller.module.js                                                                               @getsentry/orchid
/app/assets/javascripts/controllers/tab_controller.module.js                                                                               @getsentry/orchid
/app/assets/javascripts/lib/ticket_metrics.module.js                                                                               @getsentry/orchid
/app/assets/javascripts/lib/utils/anchor_scrolling.module.js                                                                               @getsentry/orchid
/app/assets/javascripts/lib/utils/word_matcher_regex.module.js                                                                               @getsentry/orchid
/app/assets/javascripts/templates/components/tabs                                                                               @getsentry/orchid
/app/assets/javascripts/templates/components/tabs_basic.js.hdbs                                                                               @getsentry/orchid
/app/assets/javascripts/templates/components/tabs_functional.js.hdbs                                                                               @getsentry/orchid
/app/assets/javascripts/templates/launchpad/benchmark_survey_agent_field.js.hdbs                                                                               @getsentry/orchid
/app/assets/javascripts/templates/layouts/branding_header.js.hdbs                                                                               @getsentry/orchid
/app/assets/javascripts/templates/modals/new_organization_refresh.js.hdbs                                                                               @getsentry/orchid
/app/assets/javascripts/templates/tickets/pane/events.js.hdbs                                                                               @getsentry/orchid
/app/assets/javascripts/templates/tickets/pane/header.js.hdbs                                                                               @getsentry/orchid
/app/assets/javascripts/views/modals/new_organization_refresh.module.js                                                                               @getsentry/orchid
/app/assets/javascripts/workspaces/workspace_redux_tabs.module.js                                                                               @getsentry/orchid
/lotus_react/cypress/integration/macros                                                                               @getsentry/orchid
/lotus_react/cypress/integration/modal                                                                               @getsentry/orchid
/lotus_react/cypress/integration/tabs                                                                               @getsentry/orchid
/lotus_react/src/components/TicketTableV2/BulkActions/BulkActionsModals/                                                                               @getsentry/orchid
/lotus_react/cypress/integration/ticket/bulkedit/bulkEditModal.spec.ts                                                                               @getsentry/orchid
/lotus_react/src/components/SuspendedTicketModal/                                                                               @getsentry/orchid
/lotus_react/src/components/UserModal/                                                                               @getsentry/orchid
/lotus_react/src/CommonProviders/DataProvider/data/macros                                                                               @getsentry/orchid
/lotus_react/src/Organization/Modal/AddModal                                                                               @getsentry/orchid
/lotus_react/cypress/integration/organizations/userModal.spec.ts                                                                               @getsentry/orchid
/lotus_react/cypress/integration/ticket/ticketMarkAsSpam.spec.js                                                                               @getsentry/orchid
/lotus_react/src/Ticket/Footer/                                                                               @getsentry/orchid
/lotus_react/src/Ticket/MacroPreview/                                                                               @getsentry/orchid
/lotus_react/src/Ticket/TicketCollisionNotification/                                                                               @getsentry/orchid
/lotus_react/cypress/integration/ticket/collision/ticketCollisionNotification/                                                                               @getsentry/orchid
/lotus_react/src/Toolbar/__tests__/                                                                               @getsentry/orchid
/lotus_react/src/Toolbar/Search/                                                                               @getsentry/orchid
/lotus_react/src/Toolbar/storybook/                                                                               @getsentry/orchid
/lotus_react/src/Toolbar/Tabs/                                                                               @getsentry/orchid
/lotus_react/cypress/integration/ticket/ticketTabsMore.spec.js                                                                               @getsentry/orchid
/lotus_react/src/Toolbar/constants.ts                                                                               @getsentry/orchid
/lotus_react/src/Toolbar/index.js                                                                               @getsentry/orchid
/lotus_react/src/Toolbar/ownConversationsQuery.gql                                                                               @getsentry/orchid
/lotus_react/src/Toolbar/README.md                                                                               @getsentry/orchid
/lotus_react/src/Toolbar/reducer.js                                                                               @getsentry/orchid
/lotus_react/src/Toolbar/reducer.d.ts                                                                               @getsentry/orchid
/lotus_react/src/Toolbar/stories.js                                                                               @getsentry/orchid
/lotus_react/src/Toolbar/tabSubtypes.ts                                                                               @getsentry/orchid
/lotus_react/src/Toolbar/tabTypes.ts                                                                               @getsentry/orchid
/lotus_react/src/components/ActionBar/                                                                               @getsentry/orchid
/lotus_react/src/components/Attachment/                                                                               @getsentry/orchid
/lotus_react/src/components/Popover/                                                                               @getsentry/orchid
/lotus_react/src/components/Table/                                                                               @getsentry/orchid
/lotus_react/.vscode/launch.json.example                                                                               @getsentry/orchid
/lotus_react/src/utils/toPureComponent.js                                                                               @getsentry/orchid
/lotus_react/src/utils/hooks/useBeforeUnload.js                                                                               @getsentry/orchid
/lotus_react/src/utils/hooks/useLocalStorage.js                                                                               @getsentry/orchid
/spec/javascripts/components/tabs                                                                               @getsentry/orchid
/spec/javascripts/controllers/add_tab_controller_spec.js                                                                               @getsentry/orchid
/spec/javascripts/controllers/email_ccs_controller_spec.js                                                                               @getsentry/orchid
/spec/javascripts/controllers/header_controller_spec.js                                                                               @getsentry/orchid
/spec/javascripts/controllers/tab_controller_spec.js                                                                               @getsentry/orchid
/spec/javascripts/controllers/ticket_controller/comments_scroll_mixin_spec.js                                                                               @getsentry/orchid
/spec/javascripts/controllers/ticket_controller/redux_bridge_spec.js                                                                               @getsentry/orchid                                                                               @getsentry/hibiscus
/spec/javascripts/workspaces/workspace_redux_tabs_spec.js                                                                               @getsentry/orchid
/lotus_react/cypress/integration/ticket/ticketDirty.spec.js                                                                               @getsentry/orchid
/lotus_react/cypress/integration/ticket/ticketUpdateVia.spec.js                                                                               @getsentry/orchid # Team Box Office
/activities/ticket_forms/                                                                               @getsentry/boxoffice
/activities/admin/javascripts/lib/request_notification.module.js                                                                               @getsentry/boxoffice
/activities/admin/javascripts/templates/admin/conditional_ticket_fields_exit.js.hdbs                                                                               @getsentry/boxoffice
/activities/admin/javascripts/views/admin/conditional_ticket_fields_exit_view.module.js                                                                               @getsentry/boxoffice
/app/assets/javascripts/models/custom_status.module.js                                                                               @getsentry/boxoffice
/app/assets/javascripts/routes/admin/ticket_forms/conditions_exit.module.js                                                                               @getsentry/boxoffice
/app/assets/javascripts/routes/admin/ticket_forms/new.module.js                                                                               @getsentry/boxoffice
/app/assets/javascripts/controllers/ticket_controller/redux_bridge.module.js                                                                               @getsentry/boxoffice                                                                               @getsentry/orchid                                                                               @getsentry/hibiscus
/app/assets/javascripts/lib/first_comment_private_tooltip.module.js                                                                               @getsentry/boxoffice
/app/assets/javascripts/views/tickets/ticket_fields/visibility_management_mixin.module.js                                                                               @getsentry/boxoffice
/lotus_react/src/CommonProviders/DataProvider/data/tags                                                                               @getsentry/boxoffice
/lotus_react/src/CommonProviders/DataProvider/data/ticketField                                                                               @getsentry/boxoffice
/lotus_react/src/CommonProviders/DataProvider/data/ticketForm                                                                               @getsentry/boxoffice
/lotus_react/src/Admin/sharedHelpers/                                                                               @getsentry/boxoffice
/lotus_react/src/Admin/sharedImages/                                                                               @getsentry/boxoffice
/lotus_react/src/Admin/TicketFields/                                                                               @getsentry/boxoffice
/lotus_react/src/Admin/TicketForm/                                                                               @getsentry/boxoffice
/lotus_react/src/Admin/TicketForms/                                                                               @getsentry/boxoffice
/lotus_react/src/Admin/ConditionalTicketFields/                                                                               @getsentry/boxoffice
/lotus_react/src/Admin/sharedComponents/                                                                               @getsentry/boxoffice
/lotus_react/src/components/Autocomplete/                                                                               @getsentry/boxoffice
/lotus_react/src/components/ConfirmationModal/                                                                               @getsentry/boxoffice
/lotus_react/src/components/NavigationPrompt/                                                                               @getsentry/boxoffice
/lotus_react/src/Ticket/StatusBadge                                                                               @getsentry/boxoffice
/lotus_react/src/Ticket/state/deprecated/                                                                               @getsentry/boxoffice
/lotus_react/src/utils/caseAndSpaceInsensitiveIncludes.js                                                                               @getsentry/boxoffice
/lotus_react/cypress/integration/ticket/ticketInProgressUpdates.spec.js                                                                               @getsentry/boxoffice
/lotus_react/cypress/integration/ticket/ticketConditionallyRequiredFields.spec.js                                                                               @getsentry/boxoffice

# Team Bilby
/activities/user/                                                                               @getsentry/bilby
/app/assets/javascripts/routes/user/                                                                               @getsentry/bilby
/app/assets/javascripts/routes/user.module.js                                                                               @getsentry/bilby
/lotus_react/src/Ticket/CustomObjects/                                                                               @getsentry/nexus
/lotus_react/src/User/                                                                               @getsentry/bilby
/spec/javascripts/routes/user/                                                                               @getsentry/bilby
/spec/javascripts/routes/user_spec.js                                                                               @getsentry/bilby
/lotus_react/src/Ticket/Customer/                                                                               @getsentry/echidna # CSAX Icarus
/activities/admin/javascripts/templates/admin/settings_migration_template.js.hdbs                                                                               @getsentry/icarus
/activities/admin/javascripts/views/admin/settings_migration_view.module.js                                                                               @getsentry/icarus
/app/assets/javascripts/routes/admin/settings_migration_route.module.js                                                                               @getsentry/icarus
/app/assets/javascripts/mixins/redirect_to_admin_center.module.js                                                                               @getsentry/icarus
/spec/javascripts/mixins/redirect_to_admin_center_spec.js                                                                               @getsentry/icarus
/app/assets/javascripts/lib/utils/iframe.module.js                                                                               @getsentry/icarus
/lotus_react/src/Admin/SettingsMigration/index.js                                                                               @getsentry/icarus
/lotus_react/src/Admin/SettingsMigration/Spacer.js                                                                               @getsentry/icarus
/lotus_react/src/Admin/SettingsMigration/SettingsMigration.js                                                                               @getsentry/icarus
/lotus_react/src/Admin/Overview/SettingsMigrationNotice.js                                                                               @getsentry/icarus
/lotus_react/src/Admin/SettingsMigration/styled.js                                                                               @getsentry/icarus
/lotus_react/src/Admin/SettingsMigration/SettingsMigrationImage.svg                                                                               @getsentry/icarus
/spec/javascripts/routes/admin/settings_migration_spec.js                                                                               @getsentry/icarus
/lotus_react/src/Admin/Overview/__tests__/SettingsMigrationNotice.test.js                                                                               @getsentry/icarus
/lotus_react/src/Admin/Overview/__tests__/__snapshots__/SettingsMigrationNotice.test.js.snap                                                                               @getsentry/icarus
/lotus_react/src/Admin/SettingsMigration/__tests__/SettingsMigration.test.js                                                                               @getsentry/icarus
/lotus_react/src/Admin/SettingsMigration/__tests__/__snapshots__/SettingsMigration.test.js.snap                                                                               @getsentry/icarus
/lotus_react/src/Admin/SettingsMigration/videos/Settings-Migration-Master-1x.mp4                                                                               @getsentry/icarus
/lotus_react/src/Admin/SettingsMigration/videos/Settings-Migration-Master-2x.mp4                                                                               @getsentry/icarus

# Team Iris
/lotus_react/cypress/integration/quickAssign                                                                               @getsentry/iris
/lotus_react/src/Ticket/SupportGraphEvaluation/                                                                               @getsentry/iris
/lotus_react/src/Ticket/TicketPropertiesSidebar/Assignee/                                                                               @getsentry/iris
/lotus_react/cypress/integration/ticket/assignee_field/                                                                               @getsentry/iris
lotus_react/cypress/integration/ticket/ticketTakeFollow.spec.js                                                                               @getsentry/iris
/lotus_react/src/Ticket/TicketBar                                                                               @getsentry/iris
/lotus_react/cypress/integration/ticket/ticketBar/                                                                               @getsentry/iris
/lotus_react/src/Toolbar/ProfileMenu/PolarisOnboardingIntroModal                                                                               @getsentry/iris
/lotus_react/src/Toolbar/ProfileMenu/ChannelSwitchingOnboardingModal                                                                               @getsentry/iris
/lotus_react/src/CommonProviders/DataProvider/data/onboarding/polaris                                                                               @getsentry/iris
/lotus_react/src/Onboarding/Polaris                                                                               @getsentry/iris
/lotus_react/src/Onboarding/OnboardingManager                                                                               @getsentry/iris
/lotus_react/src/Admin/AgentWorkspace/                                                                               @getsentry/iris
/spec/javascripts/controllers/ticket_controller/channel_switching_spec.js                                                                               @getsentry/iris
/lotus_react/src/utils/viaTypes.js                                                                               @getsentry/iris
/lotus_react/src/utils/testing/__tests__/viaTypes.test.js                                                                               @getsentry/iris
/lotus_react/src/utils/channelTypes.js                                                                               @getsentry/iris
/lotus_react/src/utils/testing/__tests__/channelTypes.test.js                                                                               @getsentry/iris
/lotus_react/src/utils/testing/Storage.js                                                                               @getsentry/iris
/lotus_react/src/utils/testing/__tests__/Storage.test.js                                                                               @getsentry/iris
/lotus_react/src/utils/hooks/useCrossFrameMessage.ts                                                                               @getsentry/iris
/lotus_react/src/utils/hooks/__tests__/useCrossFrameMessage.test.ts                                                                               @getsentry/iris
/lotus_react/src/utils/analytics.js                                                                               @getsentry/iris
/lotus_react/src/utils/hooks/__tests__/analytics.test.js                                                                               @getsentry/iris
/lotus_react/src/utils/hooks/useTimer.js                                                                               @getsentry/iris
/lotus_react/src/utils/hooks/__tests__/useTimer.test.js                                                                               @getsentry/iris
/lotus_react/src/utils/hooks/useUnsafeResizeObserver.js                                                                               @getsentry/iris
/lotus_react/src/utils/hooks/__tests__/useUnsafeResizeObserver.test.js                                                                               @getsentry/iris
/lotus_react/src/components/ChatAvatar                                                                               @getsentry/iris
/lotus_react/src/types/__tests__/LocalTypesGenerators.ts                                                                               @getsentry/iris
/app/assets/javascripts/post_initializers/polaris_notifications.module.js                                                                               @getsentry/iris
/spec/javascripts/post_initializers/polaris_notifications_spec.js                                                                               @getsentry/iris
/lotus_react/src/AgentWorkspaceAutoActivationBanner                                                                               @getsentry/iris

# Team Polo
/lotus_react/src/CommonProviders/DataProvider/data/translation/                                                                               @getsentry/polo
/lotus_react/src/Ticket/ConversationPane/data/translation/                                                                               @getsentry/polo
/lotus_react/src/Ticket/ConversationPane/components/ConversationTranslationHeader                                                                               @getsentry/polo
/lotus_react/src/Ticket/ConversationPane/components/OmniLog/components/ConversationLog/components/Comment/components/ContentWithTranslation/                                                                               @getsentry/polo
/lotus_react/src/Ticket/ConversationPane/components/OmniComposer/components/ComposerWrapper/components/TranslationStatusIcon.js                                                                               @getsentry/polo
/lotus_react/src/Ticket/ConversationPane/components/OmniComposer/components/ComposerWrapper/components/__tests__/TranslationStatusIcon.test.js                                                                               @getsentry/polo
/lotus_react/src/Ticket/ConversationPane/components/TranslationAttribution.js                                                                               @getsentry/polo
/lotus_react/src/Ticket/ConversationPane/components/__tests__/TranslationAttribution.test.js                                                                               @getsentry/polo
/lotus_react/src/Ticket/Customer/data/usePrechatFormDiscrepancy.js                                                                               @getsentry/polo                                                                               @getsentry/echidna
/lotus_react/src/Ticket/Customer/data/__tests__/usePrechatFormDiscrepancy.test.js                                                                               @getsentry/polo                                                                               @getsentry/echidna
/lotus_react/src/Ticket/Customer/data/usePrechatFormDiscrepancyPanelSwitch.js                                                                               @getsentry/polo                                                                               @getsentry/echidna
/lotus_react/src/Ticket/Customer/data/__tests__/usePrechatFormDiscrepancyPanelSwitch.test.js                                                                               @getsentry/polo                                                                               @getsentry/echidna
/lotus_react/src/utils/notifier                                                                               @getsentry/polo
/lotus_react/src/Toolbar/ServeButton/                                                                               @getsentry/polo
/lotus_react/src/Toolbar/AgentStatus/                                                                               @getsentry/polo
/lotus_react/src/Ticket/Customer/components/UserProfile/components/ProfileMismatchAlert.js                                                                               @getsentry/polo
/lotus_react/src/Ticket/Customer/components/UserProfile/components/__tests__/ProfileMismatchAlert.test.js                                                                               @getsentry/polo
/lotus_react/cypress/integration/ticket/customer/userprofile/profileMismatchAlert.spec.js                                                                               @getsentry/polo

# Team Falcon
/lotus_react/src/utils/performance/elementTimingTracker/                                                                               @getsentry/falcon
/lotus_react/src/utils/performance/metricTags/                                                                               @getsentry/falcon
/lotus_react/src/Ticket/ConversationPane/components/ThinTicketSubscriptionTrial/                                                                               @getsentry/falcon

# Team Strongbad
/app/assets/javascripts/components/email_ccs_editor_bar.module.js                                                                               @getsentry/strongbad
/app/assets/javascripts/controllers/launchpad/forwarding_flow_controller.module.js                                                                               @getsentry/strongbad
/app/assets/javascripts/lib/views/email_settings_iframe_view.module.js                                                                               @getsentry/strongbad
/app/assets/javascripts/lib/views/ticket_settings_iframe_view.module.js                                                                               @getsentry/strongbad
/app/assets/javascripts/mixins/email_ccs.module.js                                                                               @getsentry/strongbad
/app/assets/javascripts/models/collaborations.module.js                                                                               @getsentry/strongbad
/app/assets/javascripts/models/emailccs.module.js                                                                               @getsentry/strongbad
/app/assets/javascripts/models/followers.module.js                                                                               @getsentry/strongbad
/app/assets/javascripts/post_initializers/simplified_email_threading_notifications.module.js                                                                               @getsentry/strongbad
/app/assets/javascripts/routes/admin/email.module.js                                                                               @getsentry/strongbad
/app/assets/javascripts/templates/components/email_ccs_editor_bar.js.hdbs                                                                               @getsentry/strongbad
/app/assets/javascripts/templates/email/                                                                               @getsentry/strongbad
/app/assets/javascripts/templates/email_ccs/admin_onboarding.js.hdbs                                                                               @getsentry/strongbad
/app/assets/javascripts/templates/tickets/iframe.js.hdbs                                                                               @getsentry/strongbad
/app/assets/javascripts/views/email/                                                                               @getsentry/strongbad
/app/assets/javascripts/views/email_ccs/admin_onboarding_view.module.js                                                                               @getsentry/strongbad
/lotus_react/src/Admin/Collaborators/                                                                               @getsentry/strongbad
/lotus_react/src/Admin/SimplifiedEmailThreading/                                                                               @getsentry/strongbad
/lotus_react/src/CommonProviders/DataProvider/data/ticketComments/queries.js                                                                               @getsentry/strongbad
/lotus_react/src/Ticket/Collaborators/                                                                               @getsentry/strongbad
/lotus_react/src/Ticket/TicketPropertiesSidebar/Followers/                                                                               @getsentry/strongbad
/spec/javascripts/components/email_ccs_editor_bar_spec.js                                                                               @getsentry/strongbad
/spec/javascripts/controllers/launchpad/forwarding_flow_controller_spec.js                                                                               @getsentry/strongbad
/spec/javascripts/mixins/email_ccs_spec.js                                                                               @getsentry/strongbad
/spec/javascripts/post_initializers/simplified_email_threading_notifications_spec.js                                                                               @getsentry/strongbad
/spec/javascripts/views/email_ccs/admin_onboarding_view_spec.js                                                                               @getsentry/strongbad

# Team Ponderosa (Growth & Monetization)
/activities/discovery/                                                                               @getsentry/ponderosa
/activities/user/javascripts/mixins/onboarding/user_profile_nav.module.js                                                                               @getsentry/ponderosa
/app/assets/images/launchpad/                                                                               @getsentry/ponderosa
/app/assets/images/onboarding/                                                                               @getsentry/ponderosa
/app/assets/javascripts/components/launchpad_action.module.js                                                                               @getsentry/ponderosa
/app/assets/javascripts/controllers/in_product_chat_controller.module.js                                                                               @getsentry/ponderosa
/app/assets/javascripts/controllers/launchpad*                                                                               @getsentry/ponderosa
/app/assets/javascripts/lib/low_seat_count_notification.module.js                                                                               @getsentry/ponderosa                                                                               @getsentry/otters
/app/assets/javascripts/lib/trial_routing.module.js                                                                               @getsentry/ponderosa
/app/assets/javascripts/mixins/onboarding/tooltip_support.module.js                                                                               @getsentry/ponderosa
/app/assets/javascripts/models/launchpad/                                                                               @getsentry/ponderosa
/app/assets/javascripts/post_initializers/agent_seat_notifications.module.js                                                                               @getsentry/ponderosa
/app/assets/javascripts/routes/discovery*                                                                               @getsentry/ponderosa
/app/assets/javascripts/routes/lotus_react/expired_trial.module.js                                                                               @getsentry/ponderosa
/app/assets/javascripts/routes/launchpad*                                                                               @getsentry/ponderosa
/app/assets/javascripts/routes/lotus_react/get_started*                                                                               @getsentry/ponderosa
/app/assets/javascripts/routes/lotus_react/welcome.module.js                                                                               @getsentry/ponderosa
/app/assets/javascripts/templates/components/launchpad_action.js.hdbs                                                                               @getsentry/ponderosa
/app/assets/javascripts/templates/launchpad                                                                               @getsentry/ponderosa
/app/assets/javascripts/templates/layouts/apps_onboarding.js.hdbs                                                                               @getsentry/ponderosa
/app/assets/javascripts/views/dashboard/launchpad_swappable_view.module.js                                                                               @getsentry/ponderosa
/app/assets/javascripts/views/launchpad                                                                               @getsentry/ponderosa
/lotus_react/src/Chrome/DashboardToggleNav/                                                                               @getsentry/ponderosa
/lotus_react/src/Chrome/hooks                                                                               @getsentry/ponderosa
/lotus_react/src/Chrome/QuickAssist/                                                                               @getsentry/ponderosa
/lotus_react/src/Chrome/WebWidget                                                                               @getsentry/ponderosa
/lotus_react/src/components/FraudulentAccountModal/                                                                               @getsentry/ponderosa
/lotus_react/src/components/SuncoWidget/                                                                               @getsentry/ponderosa
/lotus_react/src/components/TrialExpiredDrawer/                                                                               @getsentry/ponderosa
/lotus_react/src/Onboarding/BackToOnboardingBarRenderer/                                                                               @getsentry/ponderosa
/lotus_react/src/Onboarding/ComparePlans/                                                                               @getsentry/ponderosa
/lotus_react/src/Onboarding/data/                                                                               @getsentry/ponderosa
/lotus_react/src/Onboarding/ExperimentsProvider/                                                                               @getsentry/ponderosa
/lotus_react/src/Onboarding/ExpiredTrial/                                                                               @getsentry/ponderosa
/lotus_react/src/Onboarding/GetStartedRouter/                                                                               @getsentry/ponderosa
/lotus_react/src/Onboarding/SuiteTrial/                                                                               @getsentry/ponderosa
/lotus_react/src/Onboarding/SupportGetStarted/                                                                               @getsentry/ponderosa
/lotus_react/src/Onboarding/SupportSuiteTrial/                                                                               @getsentry/ponderosa
/lotus_react/src/Onboarding/TrialWelcome/                                                                               @getsentry/ponderosa
/lotus_react/src/utils/hooks/useMetrics/                                                                               @getsentry/ponderosa
/lotus_react/cypress/integration/onboarding/                                                                               @getsentry/ponderosa
/spec/javascripts/components/launchpad_action_spec.js                                                                               @getsentry/ponderosa
/spec/javascripts/controllers/in_product_chat_controller_spec.js                                                                               @getsentry/ponderosa
/spec/javascripts/controllers/launchpad*                                                                               @getsentry/ponderosa
/spec/javascripts/fixtures/launchpad_tasks.js                                                                               @getsentry/ponderosa
/spec/javascripts/lib/low_seat_count_notification_spec.js                                                                               @getsentry/ponderosa                                                                               @getsentry/otters
/spec/javascripts/lib/trial_routing_spec.js                                                                               @getsentry/ponderosa
/spec/javascripts/mixins/onboarding/tooltip_support_spec.js                                                                               @getsentry/ponderosa
/spec/javascripts/post_initializers/agent_seat_notifications_spec.js                                                                               @getsentry/ponderosa
/spec/javascripts/routes/launchpad*                                                                               @getsentry/ponderosa
/spec/javascripts/views/launchpad*                                                                               @getsentry/ponderosa
/activities/account_suspension/javascripts/templates/modals/abusive_trial_v2.js.hdbs                                                                               @getsentry/ponderosa
/activities/account_suspension/javascripts/templates/modals/subscription/trial_expiration_v2.js.hdbs                                                                               @getsentry/ponderosa

# Team Magnolia
/lotus_react/src/Toolbar/Help/                                                                               @getsentry/magnolia
/lotus_react/cypress/integration/Chrome/webwidget/getHelp.spec.js                                                                               @getsentry/magnolia

# Team Ponderosa co-ownerships (placed directly after to override more generic patterns from above)
/activities/discovery/javascripts/controllers/email_setup/                                                                               @getsentry/ponderosa                                                                               @getsentry/strongbad
/activities/discovery/javascripts/templates/email_setup/                                                                               @getsentry/ponderosa                                                                               @getsentry/strongbad
/activities/discovery/spec/javascripts/controllers/email_setup/                                                                               @getsentry/ponderosa                                                                               @getsentry/strongbad
/app/assets/javascripts/controllers/launchpad/forwarding_flow_controller.module.js                                                                               @getsentry/ponderosa                                                                               @getsentry/strongbad
/spec/javascripts/controllers/launchpad/forwarding_flow_controller_spec.js                                                                               @getsentry/ponderosa                                                                               @getsentry/strongbad
/activities/discovery/javascripts/controllers/setup_hc/                                                                               @getsentry/ponderosa                                                                               @getsentry/taipan
/activities/discovery/javascripts/templates/setup_hc/                                                                               @getsentry/ponderosa                                                                               @getsentry/taipan

# Team Taipan
/activities/discovery/images/icons/web_widget_setup/                                                                               @getsentry/taipan
/activities/discovery/spec/javascripts/controllers/web_widget_setup/                                                                               @getsentry/taipan
/activities/discovery/javascripts/templates/web_widget_setup/                                                                               @getsentry/taipan
/activities/discovery/javascripts/controllers/web_widget_setup/                                                                               @getsentry/taipan
/activities/discovery/javascripts/views/web_widget_setup/                                                                               @getsentry/taipan

# Team Voice
/lotus_react/src/Talk/                                                                               @getsentry/voice
/activities/voice/                                                                               @getsentry/voice
/app/assets/javascripts/components/ticket_audit/voice_comment.module.js                                                                               @getsentry/voice
/spec/javascripts/components/ticket_audit/voice_comment_spec.js                                                                               @getsentry/voice
/app/assets/javascripts/lib/voice_ticket_via.module.js                                                                               @getsentry/voice
/app/assets/javascripts/controllers/call_controller.module.js                                                                               @getsentry/voice
/app/assets/images/voice/                                                                               @getsentry/voice
app/assets/javascripts/models/emergency_numbers.module.js                                                                               @getsentry/voice

# Team Red Pandas
/activities/voice/javascripts/voice/templates/call_console_current_state_message.js.hdbs                                                                               @getsentry/red-pandas
/activities/voice/javascripts/voice/templates/svg/behavior_online.js.hdbs                                                                               @getsentry/red-pandas
/activities/voice/javascripts/voice/templates/svg/behavior_offline.js.hdbs                                                                               @getsentry/red-pandas
/lotus_react/src/Talk/AgentStatus                                                                               @getsentry/red-pandas
/lotus_react/src/Talk/CallConsole                                                                               @getsentry/red-pandas
/lotus_react/src/Ticket/ConversationPane/data/events/voice/                                                                               @getsentry/red-pandas
/lotus_react/src/Ticket/ConversationPane/components/OmniLog/components/ConversationLog/components/Comment/components/Types/Voice                                                                               @getsentry/red-pandas

# Team Kelpie
/app/assets/javascripts/lib/lotus/voice_apps_state.module.js                                                                               @getsentry/kelpie
/app/assets/javascripts/views/channels/voice/call_back_app_view.module.js                                                                               @getsentry/kelpie
/spec/javascripts/views/channels/voice/call_back_app_view_spec.js                                                                               @getsentry/kelpie
/spec/javascripts/lib/lotus/voice_apps_state_spec.js                                                                               @getsentry/kelpie
/activities/app_framework/javascripts/lib/apps/events/voice.module.js                                                                               @getsentry/kelpie
/activities/app_framework/spec/javascripts/lib/apps/events/voice_spec.js                                                                               @getsentry/kelpie

# Team i18n
/config/locales                                                                               @getsentry/localization
/lotus_react/translations                                                                               @getsentry/localization

# Team Collaboration / Fellow Kids (how do you do)
/app/assets/javascripts/routes/lotus_react/new_agent_home                                                                               @getsentry/collaboration
/app/assets/javascripts/routes/ticket/conversations/thread.module.js                                                                               @getsentry/collaboration
/app/assets/javascripts/routes/ticket/events/conversations.module.js                                                                               @getsentry/collaboration
/lotus_react/cypress/integration/sideConversations/                                                                               @getsentry/collaboration
/lotus_react/cypress/support/interactions/sideConversations                                                                               @getsentry/collaboration
/lotus_react/src/Admin/ContextPanel/Panels/SideConversations                                                                               @getsentry/collaboration
/lotus_react/src/AgentHome                                                                               @getsentry/collaboration
/lotus_react/src/CommonProviders/DataProvider/data/readReceipt/                                                                               @getsentry/woodstock                                                                               @getsentry/collaboration
/lotus_react/src/components/RelativeTime                                                                               @getsentry/collaboration
/lotus_react/src/components/RichTextEditor/                                                                               @getsentry/collaboration
/lotus_react/src/SideConversations                                                                               @getsentry/collaboration
/lotus_react/src/Tasks                                                                               @getsentry/collaboration
/lotus_react/src/types/actionCable.d.ts                                                                               @getsentry/collaboration
activities/filters/javascripts/templates/filters/side_conversation_list.js.hdbs                                                                               @getsentry/collaboration
activities/filters/javascripts/views/filters/side_conversation_list_view.module.js                                                                               @getsentry/collaboration

# Team Fang
/app/assets/javascripts/controllers/ticket_controller/bulk_macro_applier.module.js                                                                               @getsentry/fang                                                                               @getsentry/hibiscus
/app/assets/javascripts/controllers/ticket_controller/macro_applier.module.js                                                                               @getsentry/fang                                                                               @getsentry/hibiscus
/app/assets/javascripts/models/macro.module.js                                                                               @getsentry/fang
/app/assets/javascripts/models/macros.module.js                                                                               @getsentry/fang
/app/assets/javascripts/routes/admin/macros.module.js                                                                               @getsentry/fang
/app/assets/javascripts/routes/admin/macros/                                                                               @getsentry/fang
/spec/javascripts/controllers/ticket_controller/bulk_macro_applier_spec.js                                                                               @getsentry/fang
/spec/javascripts/controllers/ticket_controller/macro_applier_spec.js                                                                               @getsentry/fang
/spec/javascripts/models/macro_spec.js                                                                               @getsentry/fang
/spec/javascripts/models/macros_spec.js                                                                               @getsentry/fang
/spec/javascripts/routes/macros_spec.js                                                                               @getsentry/fang
/spec/javascripts/routes/macros/                                                                               @getsentry/fang
/lotus_react/src/Admin/BusinessHours/                                                                               @getsentry/fang
/lotus_react/src/components/SLA                                                                               @getsentry/fang
/app/assets/javascripts/templates/admin/business_hours.js.hdbs                                                                               @getsentry/fang
/app/assets/javascripts/views/admin/business_hours_view.module.js                                                                               @getsentry/fang

# Team Libretto
/activities/admin/javascripts/templates/admin/triggers.js.hdbs                                                                               @getsentry/libretto
/activities/admin/javascripts/views/admin/triggers_view.module.js                                                                               @getsentry/libretto
/app/assets/javascripts/controllers/triggers_controller.module.js                                                                               @getsentry/libretto
/app/assets/javascripts/routes/admin/automations.module.js                                                                               @getsentry/libretto
/app/assets/javascripts/routes/admin/automations/                                                                               @getsentry/libretto
/app/assets/javascripts/routes/admin/triggers.module.js                                                                               @getsentry/libretto
/app/assets/javascripts/routes/admin/triggers/                                                                               @getsentry/libretto
/lotus_react/src/Admin/Triggers/                                                                               @getsentry/libretto
/lotus_react/src/Admin/TriggerCategories/                                                                               @getsentry/libretto
/spec/javascripts/routes/automations_spec.js                                                                               @getsentry/libretto
/spec/javascripts/routes/automations/                                                                               @getsentry/libretto
/spec/javascripts/routes/triggers_spec.js                                                                               @getsentry/libretto
/spec/javascripts/routes/triggers/                                                                               @getsentry/libretto

# Team Answer Bot Koalai
app/assets/images/components/guide.svg                                                                               @getsentry/koalai
app/assets/javascripts/components/rapid_resolve.module.js                                                                               @getsentry/koalai
app/assets/javascripts/models/audits/rapid_resolve_parser.module.js                                                                               @getsentry/koalai
app/assets/javascripts/routes/admin/answer_bot/email.module.js                                                                               @getsentry/koalai
app/assets/javascripts/templates/components/rapid_resolve.js.hdbs                                                                               @getsentry/koalai
spec/javascripts/components/rapid_resolve_spec.js                                                                               @getsentry/koalai
spec/javascripts/models/audits/rapid_resolve_parser_spec.js                                                                               @getsentry/koalai
spec/javascripts/routes/admin/answer_bot/email_spec.js                                                                               @getsentry/koalai

# Team Billing (Growth & Monetization)
/activities/add_agent/                                                                               @getsentry/billing
/spec/javascripts/spec_helpers/plan_selection_helpers.js                                                                               @getsentry/billing

# Team Otters (Growth & Monetization)
/app/assets/javascripts/controllers/billing/                                                                               @getsentry/otters
/app/assets/javascripts/views/billing/                                                                               @getsentry/otters
/app/assets/javascripts/templates/billing/                                                                               @getsentry/otters
/spec/javascripts/controllers/billing/                                                                               @getsentry/otters
/app/assets/javascripts/lib/billing/                                                                               @getsentry/otters                                                                               @getsentry/ponderosa
/spec/javascripts/lib/billing/                                                                               @getsentry/otters                                                                               @getsentry/ponderosa
/lotus_react/cypress/integration/toolbar/                                                                               @getsentry/otters

# Team Outback/Strongbad
/app/assets/javascripts/routes/admin/email/                                                                               @getsentry/outback                                                                               @getsentry/strongbad

# Team Silk Road
vendor/assets/javascripts/radar/radar_client.js                                                                               @getsentry/silk-road

# Team Tea Horse
/app/assets/javascripts/models/skills.module.js                                                                               @getsentry/tea-horse
/app/assets/javascripts/models/ticket/ticket_skills_permissions.module.js                                                                               @getsentry/tea-horse
/app/assets/javascripts/routes/admin/views.module.js                                                                               @getsentry/tea-horse
/app/assets/javascripts/routes/admin/views/                                                                               @getsentry/tea-horse
/lotus_react/src/Admin/Skills/                                                                               @getsentry/tea-horse
/lotus_react/src/Admin/SkillsV2/                                                                               @getsentry/tea-horse
/lotus_react/src/CommonProviders/DataProvider/data/skills/                                                                               @getsentry/tea-horse
/lotus_react/src/components/SkillMultiSelect/                                                                               @getsentry/tea-horse
/lotus_react/src/components/Table/TicketTable/cells/AttributesMatch.js                                                                               @getsentry/tea-horse
/lotus_react/src/Ticket/TicketPropertiesSidebar/Skills/                                                                               @getsentry/tea-horse
/spec/javascripts/models/ticket/ticket_skills_permissions_spec.js                                                                               @getsentry/tea-horse
/spec/javascripts/routes/views_spec.js                                                                               @getsentry/tea-horse
/spec/javascripts/routes/views/                                                                               @getsentry/tea-horse

# Team Bilby
/lotus_react/src/CustomerProfile                                                                               @getsentry/bilby
activities/user/javascripts/views/users/properties/user_type_view.module.js                                                                               @getsentry/bilby
activities/user/spec/javascripts/views/users/properties/user_type_view_spec.js                                                                               @getsentry/bilby
app/assets/javascripts/controllers/identities/                                                                               @getsentry/bilby
spec/javascripts/controllers/identities/                                                                               @getsentry/bilby
/lotus_react/cypress/integration/customerProfile                                                                               @getsentry/bilby

# Team Echidna
/lotus_react/src/CustomerProfile/components/CustomerActivityPanel/                                                                               @getsentry/echidna
/lotus_react/src/CustomerProfile/hooks/queries/eventFragment.gql                                                                               @getsentry/echidna
/lotus_react/src/CustomerProfile/hooks/queries/userEventsQuery.gql                                                                               @getsentry/echidna
/lotus_react/src/CustomerProfile/hooks/queries/userEventTypesQuery.gql                                                                               @getsentry/echidna
/lotus_react/src/CustomerProfile/hooks/useUserEvents.ts                                                                               @getsentry/echidna
/lotus_react/src/CustomerProfile/hooks/useUserEventTypes.ts                                                                               @getsentry/echidna
/lotus_react/src/CustomerProfile/hooks/queries/guide/posts.gql                                                                               @getsentry/echidna
/lotus_react/src/CustomerProfile/hooks/queries/guide/communityComments.gql                                                                               @getsentry/echidna
/lotus_react/src/CustomerProfile/hooks/usePostsQuery.ts                                                                               @getsentry/echidna
/lotus_react/src/CustomerProfile/hooks/useCommunityCommentsQuery.ts                                                                               @getsentry/echidna
/lotus_react/src/CustomerProfile/hooks/__tests__/usePostsQuery.test.ts                                                                               @getsentry/echidna
/lotus_react/src/CustomerProfile/hooks/__tests__/useCommunityCommentsQuery.test.ts                                                                               @getsentry/echidna
/lotus_react/src/CustomerProfile/hooks/__tests__/useUserEvents.test.ts                                                                               @getsentry/echidna
/lotus_react/src/CustomerProfile/hooks/useTicketsByIds.ts                                                                               @getsentry/echidna
/lotus_react/src/CustomerProfile/hooks/__tests__/useTicketsByIds.test.ts                                                                               @getsentry/echidna
/lotus_react/src/CustomerProfile/hooks/__tests__/useUserEventTypes.test.ts                                                                               @getsentry/echidna
/lotus_react/cypress/integration/customerProfile/customerActivity.spec.ts                                                                               @getsentry/echidna
/lotus_react/src/CustomerProfile/hooks/useOrganizationsQuery.ts                                                                               @getsentry/echidna
/lotus_react/src/CustomerProfile/hooks/__tests__/useOrganizationsQuery.test.ts                                                                               @getsentry/echidna
/lotus_react/src/CustomerProfile/hooks/useUsersQuery.ts                                                                               @getsentry/echidna
/lotus_react/src/CustomerProfile/hooks/__tests__/useUsersQuery.test.ts                                                                               @getsentry/echidna

# Team Snoop
/lotus_react/src/Ticket/ConversationPane/components/OmniLog/components/ConversationLog/components/CustomEvent                                                                               @getsentry/snoop                                                                               @getsentry/woodstock
/lotus_react/src/Ticket/ConversationPane/data/events/messagingEvent                                                                               @getsentry/snoop
/lotus_react/src/Ticket/ConversationPane/components/OmniLog/events/MessagingEvent                                                                               @getsentry/snoop
/lotus_react/src/Ticket/ConversationPane/components/OmniLog/components/ConversationLog/components/CustomEvent/components/MessagingEvent                                                                               @getsentry/snoop
/lotus_react/cypress/integration/ticket/commentFilter.spec.js                                                                               @getsentry/snoop

# Team Woodstock
/lotus_react/src/AgentWorkload                                                                               @getsentry/woodstock
/lotus_react/src/Ticket/ConversationPane/components/OmniLog/events/ReEngagementSent                                                                               @getsentry/woodstock
/lotus_react/src/Ticket/ConversationPane/data/events/reEngagementSent                                                                               @getsentry/woodstock
/lotus_react/src/Ticket/ConversationPane/components/OmniLog/components/ConversationLog/components/CustomEvent/components/ReEngagementSentEvent                                                                               @getsentry/woodstock

# Team Firefly
app/assets/javascripts/models/user_permissions.module.js                                                                               @getsentry/firefly
/lotus_react/src/components/GroupPrivacyIcon/                                                                               @getsentry/firefly

# Team Aster
/lotus_react/src/Ticket/Guide                                                                               @getsentry/aster
/lotus_react/src/types/zendesk/guide-markup-html-parser.d.ts                                                                               @getsentry/aster
/lotus_react/cypress/integration/ticket/knowledge/                                                                               @getsentry/aster
/lotus_react/cypress/support/data/helpCenter/                                                                               @getsentry/aster
/lotus_react/src/Admin/ContextPanel/Panels/Knowledge/                                                                               @getsentry/aster

# Team Penguin
# # New files that we added for the customer lists enhancement project

/lotus_react/src/PlatformLists                                                                               @getsentry/penguin
/lotus_react/cypress/integration/PlatformLists                                                                               @getsentry/penguin
/app/assets/javascripts/routes/lotus_react/organizations.module.js                                                                               @getsentry/penguin
/activities/filters/spec/javascripts/controllers/filter_ui_controller_spec.js                                                                               @getsentry/penguin

# Existing user_filters functionality
/app/assets/javascripts/routes/list_user_filters.module.js                                                                               @getsentry/penguin
/spec/javascripts/routes/list_user_filters_spec.js                                                                               @getsentry/penguin
/app/assets/javascripts/routes/show_user_filter.module.js                                                                               @getsentry/penguin
/spec/javascripts/routes/show_user_filter_spec.js                                                                               @getsentry/penguin
/activities/user_filters                                                                               @getsentry/penguin

# Team Kepler
app/assets/javascripts/views/reporting/resize_content.module.js                                                                               @getsentry/kepler
app/assets/javascripts/models/current_explore_subscription.module.js                                                                               @getsentry/kepler

# Team Cosmos
activities/filters/javascripts/models/filter/ticket_hydrate_resource.module.js                                                                               @getsentry/cosmos
activities/filters/javascripts/models/filter/ticket_sla_resource.module.js                                                                               @getsentry/cosmos
activities/filters/spec/javascripts/models/filter/ticket_hydrate_resource_spec.js                                                                               @getsentry/cosmos
activities/filters/spec/javascripts/models/filter/ticket_sla_resource_spec.js                                                                               @getsentry/cosmos
spec/javascripts/fixtures/ticket_hydrate.js                                                                               @getsentry/cosmos
spec/javascripts/fixtures/ticket_sla.js                                                                               @getsentry/cosmos
/lotus_react/cypress/integration/search/                                                                               @getsentry/cosmos
/lotus_react/cypress/integration/views                                                                               @getsentry/cosmos
/lotus_react/src/CommonProviders/DataProvider/remote/queries/searchQuery.gql                                                                               @getsentry/cosmos
/lotus_react/src/CommonProviders/DataProvider/data/searchBox                                                                               @getsentry/cosmos
/lotus_react/src/CommonProviders/DataProvider/data/viewTickets                                                                               @getsentry/cosmos
/lotus_react/src/CommonProviders/DataProvider/data/views                                                                               @getsentry/cosmos
/lotus_react/src/Search/                                                                               @getsentry/cosmos
/lotus_react/src/Views/                                                                               @getsentry/cosmos
/lotus_react/src/components/TicketTableV2                                                                               @getsentry/cosmos
/lotus_react/src/components/TicketTooltip                                                                               @getsentry/cosmos
/lotus_react/cypress/integration/ticket/incidents/ticketTooltip.spec.ts                                                                               @getsentry/cosmos                                                                               @getsentry/osprey

# Team Skvader
/lotus_react/src/GraphqlPlayground                                                                               @getsentry/skvader
/lotus_react/src/types/graphiql-explorer.d.ts                                                                               @getsentry/skvader
/app/assets/javascripts/routes/lotus_react/graphql_playground.module.js                                                                               @getsentry/skvader

# Team Vinyl
app/assets/javascripts/models/lookup_users.module.js                                                                               @getsentry/vinyl
app/assets/javascripts/models/lookup_organizations.module.js                                                                               @getsentry/vinyl
app/assets/javascripts/models/lookup_tickets.module.js                                                                               @getsentry/vinyl
app/assets/javascripts/routes/lotus_react/custom_object_record/index.module.js                                                                               @getsentry/vinyl
app/assets/javascripts/routes/lotus_react/custom_object_record/section.module.js                                                                               @getsentry/vinyl
app/assets/javascripts/templates/organizations/relationship_field_related_lists.js.hdbs                                                                               @getsentry/vinyl
app/assets/javascripts/views/tickets/relationship_target_type_mixin.module.js                                                                               @getsentry/vinyl
app/assets/javascripts/views/tickets/ticket_fields/react/lookup_presentational_view.module.js                                                                               @getsentry/vinyl
app/assets/javascripts/views/custom_fields/custom_field_lookup_relationship_view.module.js                                                                               @getsentry/vinyl
app/assets/javascripts/views/custom_fields/relationship_target_type_mixin.module.js                                                                               @getsentry/vinyl
lotus_react/cypress/fixtures/ticketFields/lookupRelationshipField                                                                               @getsentry/vinyl
lotus_react/cypress/integration/organizations/lookupRelationshipFields.spec.ts                                                                               @getsentry/vinyl
lotus_react/cypress/integration/customerProfile/lookupRelationshipFields.spec.ts                                                                               @getsentry/vinyl
lotus_react/cypress/integration/ticket/lookupRelationshipTicketField                                                                               @getsentry/vinyl
lotus_react/src/CustomObjectRecord/                                                                               @getsentry/vinyl
lotus_react/src/LookupRelationshipFields                                                                               @getsentry/vinyl
lotus_react/src/RelationshipFieldRelatedLists                                                                               @getsentry/vinyl

# Team Nexus
/activities/admin/javascripts/templates/admin/user_fields.js.hdbs                                                                               @getsentry/nexus
/activities/admin/javascripts/views/admin/user_fields_view.module.js                                                                               @getsentry/nexus
/lotus_react/cypress/integration/admin/customData                                                                               @getsentry/nexus
activities/admin/javascripts/views/admin/organization_fields_view.module.js                                                                               @getsentry/nexus
activities/admin/javascripts/templates/admin/organization_fields.js.hdbs                                                                               @getsentry/nexus
app/assets/javascripts/routes/admin/user_fields.module.js                                                                               @getsentry/nexus
app/assets/javascripts/routes/admin/organization_fields.module.js                                                                               @getsentry/nexus

# Team Otters
/lotus_react/src/InstantBuyCart                                                                               @getsentry/otters
/lotus_react/cypress/integration/instantBuyCart/                                                                               @getsentry/otters

# Team Kowari
activities/user/javascripts/templates/users/properties/organization_view.js.hdbs                                                                               @getsentry/kowari
app/assets/javascripts/templates/organizations/show_properties.js.hdbs                                                                               @getsentry/kowari
app/assets/javascripts/templates/organizations/mast.js.hdbs                                                                               @getsentry/kowari

# Team Lynx
lotus_react/src/Omnipanel/hooks/__tests__/useIsSmartAssistEnabled.test.ts                                                                               @getsentry/lynx
lotus_react/src/Omnipanel/hooks/useIsSmartAssistEnabled.ts                                                                               @getsentry/lynx
lotus_react/src/SmartAssist/                                                                               @getsentry/lynx

# Team One Graph
lotus_react/src/CommonProviders/DataProvider/federatedClient/                                                                               @getsentry/one-graph

# Team Belugas
/activities/account_suspension/javascripts/templates/modals/subscription/bridge_suspension_warning_v2.js.hdbs                                                                               @getsentry/belugas
app/assets/javascripts/models/billing/dunning_details.module.js                                                                               @getsentry/belugas
app/assets/javascripts/lib/billing/dunning_details.module.js                                                                               @getsentry/belugas
/lotus_react/src/components/BridgeSuspensionWarningModal                                                                               @getsentry/belugas ######################################################################### ######################################################################### ######################################################################### ######################################################################### ######################################################################### #########################################################################

# The last match wins, so place any critical ownership things below this: ######################################################################### ######################################################################### ######################################################################### ######################################################################### ######################################################################### #########################################################################

# Team Harrier
tsconfig.json                                                                               @getsentry/harrier
tsconfigBase.json                                                                               @getsentry/harrier
tsconfigForESLint.json                                                                               @getsentry/harrier


# Please keep this file in ascending alphabetical order, to the extent possible.
# # This is a CODEOWNERS file. See
# https://help.github.com/articles/about-codeowners/
.rubocop.yml                                                                               @getsentryruby-core
/.github/dependabot.yml                                                                               @getsentryruby-core
/.github/workflows/ci-dep-next.yml                                                                               @getsentryruby-core
/.github/workflows/ci.yml                                                                               @getsentryruby-core
/.github/workflows/update-after-dependabot.yml                                                                               @getsentryruby-core
/.mdl_style.rb                                                                               @getsentryruby-core
/.pryrc                                                                               @getsentryruby-core
/.rspec                                                                               @getsentryruby-core
/.ruby-version                                                                               @getsentryruby-core
/.yamllint.yml                                                                               @getsentryruby-core
/Gemfile                                                                               @getsentryruby-core
/Gemfile.lock                                                                               @getsentryruby-core
/Gemfile_next.lock                                                                               @getsentryruby-core
/app/abilities/article_ability.rb                                                                               @getsentryenigma
/app/abilities/category_ability.rb                                                                               @getsentryenigma
/app/abilities/community_*                                                                               @getsentryultra
/app/abilities/dc/translation_ability.rb                                                                               @getsentryenigma
/app/abilities/deleted_user_segment_ability.rb                                                                               @getsentryenigma
/app/abilities/local_user_ability.rb                                                                               @getsentrypiratos
/app/abilities/section_ability.rb                                                                               @getsentryenigma
/app/abilities/section_subscription_ability.rb                                                                               @getsentryenigma
/app/abilities/user_segment_ability.rb                                                                               @getsentryenigma
/app/backfills/account_unpublish_backfill.rb                                                                               @getsentryguide-search
/app/backfills/article_missing_archive_event_backfill.rb                                                                               @getsentryohana
/app/backfills/brand_entity_encoders/                                                                               @getsentrypiratos
/app/backfills/community_*                                                                               @getsentryultra
/app/backfills/delete_bad_snapshots.rb                                                                               @getsentryohana
/app/backfills/ensure_moderated_content_user_matches_author_backfill.rb                                                                               @getsentryultra
/app/backfills/guide_article_archived_backfill.rb                                                                               @getsentryathene
/app/backfills/kb_event_body_backfill.rb                                                                               @getsentryohana
/app/backfills/missing_article_delete_event_backfill.rb                                                                               @getsentryenigma
/app/backfills/restore_z2_content_backfill.deleted_content.json                                                                               @getsentryenigma
/app/backfills/restore_z2_content_backfill.rb                                                                               @getsentryenigma
/app/backfills/restore_z2_post_subscriptions_backfill.rb                                                                               @getsentryenigma
/app/backfills/retrieve_article.rb                                                                               @getsentryohana
/app/backfills/unused_attachment_removal_backfill.rb                                                                               @getsentryohana
/app/consumers/account_info_consumer.rb                                                                               @getsentrypiratos
/app/consumers/article_export/article_aggregated_views_consumer.rb                                                                               @getsentryguide-search
/app/consumers/article_export/article_change_consumer.rb                                                                               @getsentryenigma
/app/consumers/at_mentions*                                                                               @getsentryultra
/app/consumers/at_mentions/                                                                               @getsentryultra
/app/consumers/brands/*                                                                               @getsentrypiratos
/app/consumers/community*                                                                               @getsentryultra
/app/consumers/community_badges/                                                                               @getsentryultra
/app/consumers/community_consumers/                                                                               @getsentryultra
/app/consumers/content_tag_entities_consumer.rb                                                                               @getsentryultra
/app/consumers/email_templates/external_content*                                                                               @getsentryguide-search
/app/consumers/exodus/                                                                               @getsentryguide-search
/app/consumers/outgoing_email_consumer.rb                                                                               @getsentryenigma
/app/consumers/products/                                                                               @getsentryvikings
/app/consumers/products_consumer.rb                                                                               @getsentryvikings
/app/consumers/protobuf_parser.rb                                                                               @getsentryohana
/app/consumers/reusable_content/                                                                               @getsentryohana
/app/consumers/reusable_content/sync_to_guide_article_consumer.rb                                                                               @getsentryathene
/app/consumers/ticket_comment_consumer/                                                                               @getsentryaster                                                                               @getsentryenigma
/app/consumers/user_deletion_request_consumer.rb                                                                               @getsentrypiratos
/app/consumers/users/                                                                               @getsentrypiratos
/app/consumers/users_consumer.rb                                                                               @getsentrypiratos
/app/consumers/users_validation_consumer.rb                                                                               @getsentrypiratos
/app/controllers/account_data_deletion_controller.rb                                                                               @getsentryguide-search
/app/controllers/admin/arrange_contents_controller.rb                                                                               @getsentryenigma
/app/controllers/admin/articles_controller.rb                                                                               @getsentryenigma
/app/controllers/admin/categories_controller.rb                                                                               @getsentryenigma
/app/controllers/admin/local_previews_controller.rb                                                                               @getsentryvikings
/app/controllers/admin/topics_controller.rb                                                                               @getsentryultra
/app/controllers/admin/translations_controller.rb                                                                               @getsentryenigma
/app/controllers/answer_bot/                                                                               @getsentrywaratah                                                                               @getsentryvikings
/app/controllers/api/common/community*                                                                               @getsentryultra
/app/controllers/api/internal/aggregated_user_profile_controller.rb                                                                               @getsentryultra
/app/controllers/api/internal/answer_bot/                                                                               @getsentrywaratah                                                                               @getsentryvikings
/app/controllers/api/internal/arrange_articles/                                                                               @getsentryenigma
/app/controllers/api/internal/articles_controller.rb                                                                               @getsentryenigma
/app/controllers/api/internal/comments*                                                                               @getsentryultra
/app/controllers/api/internal/communities*                                                                               @getsentryultra
/app/controllers/api/internal/community_enabled_controller.rb                                                                               @getsentryultra
/app/controllers/api/internal/deflection_controller.rb                                                                               @getsentryguide-search
/app/controllers/api/internal/experiments/                                                                               @getsentryvikings
/app/controllers/api/internal/gather_trials_controller.rb                                                                               @getsentryvikings
/app/controllers/api/internal/guide_chrome_controller.rb                                                                               @getsentryvikings
/app/controllers/api/internal/guide_features_controller.rb                                                                               @getsentryvikings
/app/controllers/api/internal/import_articles_controller.rb                                                                               @getsentryvikings
/app/controllers/api/internal/importer_google_auth_controller.rb                                                                               @getsentryvikings
/app/controllers/api/internal/instant_search_controller.rb                                                                               @getsentryguide-search
/app/controllers/api/internal/knowledge_capture_features_controller.rb                                                                               @getsentryenigma
/app/controllers/api/internal/mobile_settings_controller.rb                                                                               @getsentryvikings
/app/controllers/api/internal/moderated_contents_controller.rb                                                                               @getsentryultra
/app/controllers/api/internal/moderation_subscriptions_controller.rb                                                                               @getsentryultra
/app/controllers/api/internal/on_boarding_requests_controller.rb                                                                               @getsentryvikings
/app/controllers/api/internal/recent_activities_controller.rb                                                                               @getsentryenigma
/app/controllers/api/internal/search_settings_controller.rb                                                                               @getsentryguide-search
/app/controllers/api/internal/sections_controller.rb                                                                               @getsentryenigma
/app/controllers/api/internal/theming/                                                                               @getsentryvikings
/app/controllers/api/internal/user_alias_controller.rb                                                                               @getsentryultra
/app/controllers/api/mobile/article_tree_controller.rb                                                                               @getsentryenigma
/app/controllers/api/mobile/articles_controller.rb                                                                               @getsentryenigma
/app/controllers/api/mobile/search_controller.rb                                                                               @getsentryguide-search
/app/controllers/api/mobile/single_article_controller.rb                                                                               @getsentryenigma
/app/controllers/api/v2/articles/comments_controller.rb                                                                               @getsentryultra
/app/controllers/api/v2/articles/embeddable_search_controller.rb                                                                               @getsentryguide-search
/app/controllers/api/v2/articles/search_controller.rb                                                                               @getsentryguide-search
/app/controllers/api/v2/articles/stats_view_controller.rb                                                                               @getsentrypiratos
/app/controllers/api/v2/articles/translations_controller.rb                                                                               @getsentryenigma
/app/controllers/api/v2/articles_controller.rb                                                                               @getsentryenigma
/app/controllers/api/v2/categories/articles_controller.rb                                                                               @getsentryenigma
/app/controllers/api/v2/categories/sections_controller.rb                                                                               @getsentryenigma
/app/controllers/api/v2/categories_controller.rb                                                                               @getsentryenigma
/app/controllers/api/v2/communities*                                                                               @getsentryultra
/app/controllers/api/v2/community*                                                                               @getsentryultra
/app/controllers/api/v2/community_posts/search_controller.rb                                                                               @getsentryguide-search
/app/controllers/api/v2/knowledge_capture_events_controller.rb                                                                               @getsentryultra
/app/controllers/api/v2/posts/comments/votes_controller.rb                                                                               @getsentryultra
/app/controllers/api/v2/posts/comments_controller.rb                                                                               @getsentryultra
/app/controllers/api/v2/posts/stats_view_controller.rb                                                                               @getsentrypiratos
/app/controllers/api/v2/posts/subscriptions_controller.rb                                                                               @getsentryultra
/app/controllers/api/v2/posts/votes_controller.rb                                                                               @getsentryultra
/app/controllers/api/v2/posts_controller.rb                                                                               @getsentryultra
/app/controllers/api/v2/search_controller.rb                                                                               @getsentryguide-search
/app/controllers/api/v2/sections/articles_controller.rb                                                                               @getsentryenigma
/app/controllers/api/v2/sections_controller.rb                                                                               @getsentryenigma
/app/controllers/api/v2/stats/community*                                                                               @getsentryultra
/app/controllers/api/v2/topics*                                                                               @getsentryultra
/app/controllers/api/v2/translations_controller.rb                                                                               @getsentryenigma
/app/controllers/api/v2/user_segments_controller.rb                                                                               @getsentryenigma
/app/controllers/articles_controller.rb                                                                               @getsentryenigma
/app/controllers/assets_controller.rb                                                                               @getsentryvikings
/app/controllers/categories_controller.rb                                                                               @getsentryenigma
/app/controllers/comments_controller.rb                                                                               @getsentryultra
/app/controllers/communities/                                                                               @getsentryultra
/app/controllers/concerns/activity_logging.rb                                                                               @getsentrypiratos
/app/controllers/concerns/api_authentication.rb                                                                               @getsentryruby-core
/app/controllers/concerns/authentication.rb                                                                               @getsentryruby-core
/app/controllers/concerns/clean_params_on_error.rb                                                                               @getsentryenigma
/app/controllers/concerns/comment_on_queries.rb                                                                               @getsentryruby-core
/app/controllers/concerns/community_access.rb                                                                               @getsentryultra
/app/controllers/concerns/database_offloading.rb                                                                               @getsentryruby-core
/app/controllers/concerns/help_center_data_cookie.rb                                                                               @getsentrypiratos
/app/controllers/concerns/locale_parameter_validation.rb                                                                               @getsentryenigma
/app/controllers/concerns/permit_only.rb                                                                               @getsentryenigma
/app/controllers/concerns/plan_access.rb                                                                               @getsentryvikings
/app/controllers/concerns/relative_positioning.rb                                                                               @getsentryenigma
/app/controllers/concerns/role_previewing.rb                                                                               @getsentryvikings
/app/controllers/concerns/template_resolution.rb                                                                               @getsentryvikings
/app/controllers/concerns/template_resolver.rb                                                                               @getsentryvikings
/app/controllers/concerns/theme_access.rb                                                                               @getsentryvikings
/app/controllers/concerns/theming_assets.rb                                                                               @getsentryvikings
/app/controllers/content_unsubscription_from_token_controller.rb                                                                               @getsentryultra
/app/controllers/custom_pages_controller.rb                                                                               @getsentryultra
/app/controllers/favicon_assets_controller.rb                                                                               @getsentryvikings
/app/controllers/logo_assets_controller.rb                                                                               @getsentryvikings
/app/controllers/request_organization_subscriptions_controller.rb                                                                               @getsentryvikings
/app/controllers/request_organizations_controller.rb                                                                               @getsentryvikings
/app/controllers/request_uploads_controller.rb                                                                               @getsentryvikings
/app/controllers/requests_controller.rb                                                                               @getsentryvikings
/app/controllers/root_controller.rb                                                                               @getsentryvikings
/app/controllers/search_controller.rb                                                                               @getsentryguide-search
/app/controllers/sections_controller.rb                                                                               @getsentryenigma
/app/controllers/sitemap_controller.rb                                                                               @getsentryenigma
/app/controllers/start_controller.rb                                                                               @getsentryvikings
/app/controllers/theming_assets_controller.rb                                                                               @getsentryvikings
/app/controllers/unsubscription_from_token_controller.rb                                                                               @getsentryultra
/app/controllers/user_profiles_controller.rb                                                                               @getsentryultra
/app/event_handlers/article_notifications_handler.rb                                                                               @getsentryenigma
/app/experiments/local_user_experiment.rb                                                                               @getsentrypiratos
/app/forms/api/create_category_form.rb                                                                               @getsentryenigma
/app/forms/api/create_section_form.rb                                                                               @getsentryenigma
/app/forms/api/create_subscription_form.rb                                                                               @getsentryenigma
/app/forms/api/create_translation_form.rb                                                                               @getsentryenigma
/app/forms/api/update_article_attachments_form.rb                                                                               @getsentryenigma
/app/forms/api/update_article_form.rb                                                                               @getsentryenigma
/app/forms/api/update_section_form.rb                                                                               @getsentryenigma
/app/forms/api/update_subscription_form.rb                                                                               @getsentryenigma
/app/forms/api/update_translation_form.rb                                                                               @getsentryenigma
/app/forms/category_form.rb                                                                               @getsentryenigma
/app/forms/community_*                                                                               @getsentryultra
/app/forms/request_create_form.rb                                                                               @getsentryvikings
/app/forms/request_organization_form.rb                                                                               @getsentryvikings
/app/forms/request_update_form.rb                                                                               @getsentryvikings
/app/forms/section_form.rb                                                                               @getsentryenigma
/app/graph/directives/contact.rb                                                                               @getsentryone-graph
/app/graph/enums/federated_search_query_source.rb                                                                               @getsentryguide-search
/app/graph/enums/owner_type_enum.rb                                                                               @getsentryenigma
/app/graph/enums/verification_status_enum.rb                                                                               @getsentryenigma
/app/graph/scalars/date_time.rb                                                                               @getsentryone-graph
/app/graph/types/base_field.rb                                                                               @getsentryenigma
/app/graph/types/base_interface.rb                                                                               @getsentryenigma
/app/graph/types/base_object.rb                                                                               @getsentryenigma
/app/graph/types/federated_search_connection.rb                                                                               @getsentryguide-search
/app/graph/types/federated_search_edge.rb                                                                               @getsentryguide-search
/app/graph/types/federated_search_filter_input.rb                                                                               @getsentryguide-search
/app/graph/types/federated_search_query_input.rb                                                                               @getsentryguide-search
/app/graph/types/federated_search_result_type.rb                                                                               @getsentryguide-search
/app/graph/types/general_settings_*.rb                                                                               @getsentryenigma
/app/graph/types/guide_product_type.rb                                                                               @getsentryenigma
/app/graph/types/owner_reference_type.rb                                                                               @getsentryenigma
/app/graph/types/pages/base.rb                                                                               @getsentryguide-search
/app/graph/types/pages/federated_search.rb                                                                               @getsentryguide-search
/app/graph/utils/help_center.rb                                                                               @getsentryenigma
/app/graph/utils/helpers.rb                                                                               @getsentryenigma
/app/graph/utils/paginator.rb                                                                               @getsentryguide-search
/app/helpers/limits_helper.rb                                                                               @getsentryenigma
/app/helpers/query_commenter.rb                                                                               @getsentryruby-core
/app/helpers/relative_url_helper.rb                                                                               @getsentryenigma
/app/helpers/search_caching_helper.rb                                                                               @getsentryguide-search
/app/instrumentation/curlybars_instrumentation.rb                                                                               @getsentryvikings
/app/instrumentation/plan_lifecycle_instrumentation.rb                                                                               @getsentryvikings
/app/instrumentation/user_segment_scope_instrumentation.rb                                                                               @getsentryenigma
/app/jobs/article_notifications_job.rb                                                                               @getsentryenigma
/app/jobs/category_deletion_job.rb                                                                               @getsentryenigma
/app/jobs/clean_old_spam_job.rb                                                                               @getsentryultra
/app/jobs/clean_unused_images_job.rb                                                                               @getsentryultra
/app/jobs/comment_edit_notifications_job.rb                                                                               @getsentryultra
/app/jobs/comment_notifications_job.rb                                                                               @getsentryultra
/app/jobs/community_*                                                                               @getsentryultra
/app/jobs/create_help_center_job.rb                                                                               @getsentryvikings
/app/jobs/delete_help_center_content_job.rb                                                                               @getsentrypiratos
/app/jobs/delete_user_community_post_activity_job.rb                                                                               @getsentryultra
/app/jobs/delete_user_content_job.rb                                                                               @getsentrypiratos
/app/jobs/exodus/                                                                               @getsentryguide-search
/app/jobs/hard_delete_articles_job.rb                                                                               @getsentryenigma
/app/jobs/hard_delete_content_job.rb                                                                               @getsentrypiratos
/app/jobs/hard_delete_knowledge_events_job.rb                                                                               @getsentryenigma
/app/jobs/moderated_content_notifications_job.rb                                                                               @getsentryultra
/app/jobs/new_spam_notification_job.rb                                                                               @getsentryultra
/app/jobs/refresh_sitemap_index_job.rb                                                                               @getsentryenigma
/app/jobs/refresh_sitemap_job.rb                                                                               @getsentryenigma
/app/jobs/section_deletion_job.rb                                                                               @getsentryenigma
/app/jobs/sitemap_refresh_enqueuer_job.rb                                                                               @getsentryenigma
/app/jobs/topic_deletion_job.rb                                                                               @getsentryenigma
/app/jobs/user_notifications/*                                                                               @getsentryultra
/app/mailers/community_*.rb                                                                               @getsentryenigma
/app/models/account_info.rb                                                                               @getsentrypiratos
/app/models/answer_bot/                                                                               @getsentrywaratah
/app/models/article.rb                                                                               @getsentryenigma
/app/models/category.rb                                                                               @getsentryenigma
/app/models/category_deletion_manager.rb                                                                               @getsentryenigma
/app/models/category_destroyer.rb                                                                               @getsentryenigma
/app/models/community_content.rb                                                                               @getsentryultra
/app/models/community_content/at_mentions_pipeline_step.rb                                                                               @getsentryultra
/app/models/community_content/mentionable_users.rb                                                                               @getsentryultra
/app/models/community_content/remove_id_class_step.rb                                                                               @getsentryultra
/app/models/concerns/alternate_template.rb                                                                               @getsentryvikings
/app/models/concerns/articles_sorting.rb                                                                               @getsentryenigma
/app/models/concerns/positioned.rb                                                                               @getsentryenigma
/app/models/concerns/positioning.rb                                                                               @getsentryenigma
/app/models/concerns/source_translation.rb                                                                               @getsentryenigma
/app/models/concerns/user_association.rb                                                                               @getsentrypiratos
/app/models/content_moderation/                                                                               @getsentryultra
/app/models/content_tag.rb                                                                               @getsentryultra
/app/models/custom_field_option.rb                                                                               @getsentryvikings
/app/models/custom_request_status.rb                                                                               @getsentryvikings
/app/models/deleted_user_segment.rb                                                                               @getsentryenigma
/app/models/elasticsearch/                                                                               @getsentryguide-search
/app/models/exodus/                                                                               @getsentryguide-search
/app/models/experiments/                                                                               @getsentryvikings
/app/models/gather_plan.rb                                                                               @getsentryvikings
/app/models/gather_plan_manager.rb                                                                               @getsentryvikings
/app/models/general_settings_updater.rb                                                                               @getsentryenigma
/app/models/guide_search/                                                                               @getsentryguide-search
/app/models/hierarchy_event.rb                                                                               @getsentryenigma
/app/models/knowledge/article_aggregate.rb                                                                               @getsentryenigma
/app/models/knowledge/article_command/add_translation.rb                                                                               @getsentryenigma
/app/models/knowledge/article_command/bulk_archive.rb                                                                               @getsentryenigma
/app/models/knowledge/article_command/bulk_close_for_comments.rb                                                                               @getsentryenigma
/app/models/knowledge/article_command/bulk_command.rb                                                                               @getsentryenigma
/app/models/knowledge/article_command/bulk_open_for_comments.rb                                                                               @getsentryenigma
/app/models/knowledge/article_command/bulk_permit_management.rb                                                                               @getsentryenigma
/app/models/knowledge/article_command/bulk_publish_translation.rb                                                                               @getsentryenigma
/app/models/knowledge/article_command/bulk_remove.rb                                                                               @getsentryenigma
/app/models/knowledge/article_command/bulk_restore.rb                                                                               @getsentryenigma
/app/models/knowledge/article_command/bulk_restrict_viewing.rb                                                                               @getsentryenigma
/app/models/knowledge/article_command/bulk_unrestrict_viewing.rb                                                                               @getsentryenigma
/app/models/knowledge/article_command/bulk_withdraw_translation.rb                                                                               @getsentryenigma
/app/models/knowledge/article_command/create.rb                                                                               @getsentryenigma
/app/models/knowledge/article_command/publish_translation.rb                                                                               @getsentryenigma
/app/models/knowledge/article_command/publish_translation_v3.rb                                                                               @getsentryenigma
/app/models/knowledge/article_command/remove_translation.rb                                                                               @getsentryenigma
/app/models/knowledge/article_command/restore.rb                                                                               @getsentryenigma
/app/models/knowledge/article_command/translation_command.rb                                                                               @getsentryenigma
/app/models/knowledge/article_command/update_schedules.rb                                                                               @getsentryenigma
/app/models/knowledge/article_command/update_translation.rb                                                                               @getsentryenigma
/app/models/knowledge/article_command/update_translation_schedules.rb                                                                               @getsentryenigma
/app/models/knowledge/article_command/withdraw_translation.rb                                                                               @getsentryenigma
/app/models/knowledge/article_command/withdraw_translation_v3.rb                                                                               @getsentryenigma
/app/models/knowledge/article_snapshot.rb                                                                               @getsentryenigma
/app/models/knowledge/create_handler.rb                                                                               @getsentryenigma
/app/models/knowledge/event.rb                                                                               @getsentryenigma
/app/models/knowledge/limit_error.rb                                                                               @getsentryenigma
/app/models/knowledge/translation_body.rb                                                                               @getsentryohana
/app/models/knowledge/translation_body_resolver.rb                                                                               @getsentryohana
/app/models/knowledge/translation_update_notifier.rb                                                                               @getsentryenigma
/app/models/knowledge_capture/                                                                               @getsentryenigma
/app/models/knowledge_capture_app_installer.rb                                                                               @getsentryenigma
/app/models/last_search_storage.rb                                                                               @getsentrypiratos
/app/models/local_user.rb                                                                               @getsentrypiratos
/app/models/navbar_renderer/                                                                               @getsentryvikings
/app/models/open_graph/article_meta_tags.rb                                                                               @getsentryenigma
/app/models/path_steps.rb                                                                               @getsentryenigma
/app/models/permission_group.rb                                                                               @getsentryenigma
/app/models/permission_group_privilege.rb                                                                               @getsentryenigma
/app/models/plan.rb                                                                               @getsentryvikings
/app/models/plan_definition.rb                                                                               @getsentryvikings
/app/models/plan_downgrade/                                                                               @getsentryvikings
/app/models/plan_manager.rb                                                                               @getsentryvikings
/app/models/positioner.rb                                                                               @getsentryenigma
/app/models/post_content_tagging.rb                                                                               @getsentryultra
/app/models/preview_bar_renderer.rb                                                                               @getsentryvikings
/app/models/preview_role.rb                                                                               @getsentryvikings
/app/models/preview_template.rb                                                                               @getsentryvikings
/app/models/published_template.rb                                                                               @getsentryvikings
/app/models/renderer_selector.rb                                                                               @getsentryenigma
/app/models/request.rb                                                                               @getsentryvikings
/app/models/request_attachments.rb                                                                               @getsentryvikings
/app/models/request_backend.rb                                                                               @getsentryvikings
/app/models/request_comment.rb                                                                               @getsentryvikings
/app/models/request_comment_backend.rb                                                                               @getsentryvikings
/app/models/request_creation_throttler.rb                                                                               @getsentryvikings
/app/models/request_error_handler.rb                                                                               @getsentryvikings
/app/models/request_field.rb                                                                               @getsentryvikings
/app/models/request_group.rb                                                                               @getsentryvikings
/app/models/request_metadata.rb                                                                               @getsentryvikings
/app/models/request_organization_backend.rb                                                                               @getsentryvikings
/app/models/request_prefiller.rb                                                                               @getsentryvikings
/app/models/request_status.rb                                                                               @getsentryvikings
/app/models/satisfaction_rating.rb                                                                               @getsentryvikings
/app/models/satisfaction_reason_backend.rb                                                                               @getsentryvikings
/app/models/search_settings.rb                                                                               @getsentryguide-search
/app/models/section.rb                                                                               @getsentryenigma
/app/models/section_breadcrumbs.rb                                                                               @getsentryenigma
/app/models/section_deletion_manager.rb                                                                               @getsentryenigma
/app/models/section_destroyer.rb                                                                               @getsentryenigma
/app/models/section_subscription.rb                                                                               @getsentryenigma
/app/models/section_visibility_cache.rb                                                                               @getsentryenigma
/app/models/seo/sitemap/                                                                               @getsentryenigma
/app/models/support_product.rb                                                                               @getsentryvikings
/app/models/theming_metadata.rb                                                                               @getsentryvikings
/app/models/theming_onboarder.rb                                                                               @getsentryvikings
/app/models/theming_settings.rb                                                                               @getsentryvikings
/app/models/theming_template_resolver.rb                                                                               @getsentryvikings
/app/models/ticket_field_backend.rb                                                                               @getsentryvikings
/app/models/ticket_fields/                                                                               @getsentryvikings
/app/models/ticket_form_backend.rb                                                                               @getsentryvikings
/app/models/ticket_form_labeler.rb                                                                               @getsentryvikings
/app/models/translations/                                                                               @getsentryenigma
/app/models/translations_filter.rb                                                                               @getsentryenigma
/app/models/user_organization.rb                                                                               @getsentryvikings
/app/models/user_organization_backend.rb                                                                               @getsentryvikings
/app/models/user_organizations.rb                                                                               @getsentryvikings
/app/models/user_segment.rb                                                                               @getsentryenigma
/app/models/user_segment/                                                                               @getsentryenigma
/app/models/visible_articles.rb                                                                               @getsentryenigma
/app/models/visible_categories.rb                                                                               @getsentryenigma
/app/models/visible_sections.rb                                                                               @getsentryenigma
/app/presenters/chrome/gather_trial_presenter.rb                                                                               @getsentryvikings # Vikings co-owns HBS presenters with domain-specific teams
/app/presenters/hbs/                                                                               @getsentryvikings
/app/presenters/hbs/content_tag_presenter.rb                                                                               @getsentryultra                                                                               @getsentryvikings
/app/presenters/hbs/search/                                                                               @getsentryguide-search                                                                               @getsentryvikings
/app/presenters/hbs/search_result_presenter.rb                                                                               @getsentryguide-search                                                                               @getsentryvikings
/app/presenters/hbs/search_result_presenter/                                                                               @getsentryguide-search                                                                               @getsentryvikings
/app/presenters/requests/                                                                               @getsentryvikings
/app/queries/article_incremental_query.rb                                                                               @getsentryenigma
/app/queries/article_query.rb                                                                               @getsentryenigma
/app/queries/category_query.rb                                                                               @getsentryenigma
/app/queries/community_post_query.rb                                                                               @getsentryultra
/app/queries/community_post_with_pinnings_query.rb                                                                               @getsentryultra
/app/queries/federated_search_query.rb                                                                               @getsentryguide-search
/app/queries/knowledge_capture_event_query.rb                                                                               @getsentryenigma
/app/queries/mobile_article_query.rb                                                                               @getsentryenigma
/app/queries/position_query.rb                                                                               @getsentryenigma
/app/queries/section_query.rb                                                                               @getsentryenigma
/app/renderers/answer_bot_article_renderer.rb                                                                               @getsentrywaratah
/app/renderers/article_renderer.rb                                                                               @getsentryenigma
/app/renderers/reverse_markdown_renderer.rb                                                                               @getsentryenigma
/app/renderers/simple_format_renderer.rb                                                                               @getsentryenigma
/app/renderers/text_html_renderer.rb                                                                               @getsentryenigma
/app/renderers/text_plain_renderer.rb                                                                               @getsentryenigma
/app/scopes/article_scope.rb                                                                               @getsentryenigma
/app/scopes/category_scope.rb                                                                               @getsentryenigma
/app/scopes/permission_group_scope.rb                                                                               @getsentryenigma
/app/scopes/section_scope.rb                                                                               @getsentryenigma
/app/scopes/translation_scope.rb                                                                               @getsentryenigma
/app/scopes/user_segment_scope.rb                                                                               @getsentryenigma
/app/serializers/answer_bot/                                                                               @getsentrywaratah
/app/serializers/api/internal/answer_bot/                                                                               @getsentrywaratah
/app/serializers/api/internal/arrange_articles/                                                                               @getsentryenigma
/app/serializers/arrange_contents/                                                                               @getsentryenigma
/app/serializers/noams/user_segment_*                                                                               @getsentryenigma
/app/serializers/user_segments/                                                                               @getsentryenigma
/app/services/article_exporter.rb                                                                               @getsentryenigma
/app/services/article_exporter/*                                                                               @getsentryenigma
/app/services/article_exporter/article_standard_object_publisher.rb                                                                               @getsentrypiratos
/app/services/article_exporter/article_views_status.rb                                                                               @getsentryguide-search
/app/services/comment_exporter.rb                                                                               @getsentryultra
/app/services/community*                                                                               @getsentryultra
/app/services/explore_tools/                                                                               @getsentrypiratos
/app/services/user_segment_service_graphql.rb                                                                               @getsentryenigma
/app/statistics/content/                                                                               @getsentryohana
/app/uploaders/mobile_logo_uploader.rb                                                                               @getsentryvikings
/app/views/admin/arrange_contents/                                                                               @getsentryenigma
/app/views/admin/categories/                                                                               @getsentryenigma
/app/views/admin/import_articles/                                                                               @getsentryvikings
/app/views/article_mailer/                                                                               @getsentryenigma
/app/views/categories/                                                                               @getsentryenigma
/app/views/community*/                                                                               @getsentryultra
/app/views/content_unsubscription_from_token/                                                                               @getsentryultra
/app/views/external_content_mailer/                                                                               @getsentryguide-search
/app/views/mentions*/                                                                               @getsentryultra
/app/views/requests/                                                                               @getsentryvikings
/app/views/section_comment_mailer/                                                                               @getsentryenigma
/app/views/sections/                                                                               @getsentryenigma
/app/views/shared/_cursor_pagination.html.hbs                                                                               @getsentryultra
/app/views/user_subscription_comment_mailer/                                                                               @getsentryultra
/app/views/user_subscription_community_comment_mailer/                                                                               @getsentryultra
/app/views/user_subscription_community_post_mailer/                                                                               @getsentryultra
/bin/brakeman                                                                               @getsentryruby-core
/bin/consume-article-standard-objects                                                                               @getsentrypiratos
/bin/parallel_rspec                                                                               @getsentryruby-core
/bin/rails-erb-lint                                                                               @getsentryruby-core
/bin/rspec                                                                               @getsentryruby-core
/bin/rubocop                                                                               @getsentryruby-core
/bin/test-bundler-version-in-dockerfile                                                                               @getsentryruby-core
/bin/test-bundler-version-in-integration-test-dockerfile                                                                               @getsentryruby-core
/bin/test-dotenv-files                                                                               @getsentryruby-core
/bin/test-gem-versions-in-dockerfile                                                                               @getsentryruby-core
/bin/zdi-client-only                                                                               @getsentryultra
/chrome-extension-frontend-devmode/                                                                               @getsentryultra
/config/.env.zendesk.*                                                                               @getsentryruby-core
/config/environment.rb                                                                               @getsentryruby-core
/config/environments/                                                                               @getsentryruby-core
/config/initializers/00_global_uid.rb                                                                               @getsentryruby-core
/config/initializers/01_pod.rb                                                                               @getsentryruby-core
/config/initializers/03_setup_oauth.rb                                                                               @getsentryruby-core
/config/initializers/09_middleware.rb                                                                               @getsentryruby-core
/config/initializers/10_theme_host.rb                                                                               @getsentryvikings
/config/initializers/active_record_shards.rb                                                                               @getsentryruby-core
/config/initializers/ar_patch.rb                                                                               @getsentryruby-core
/config/initializers/community_badges.rb                                                                               @getsentryultra
/config/initializers/community_moderator_groups.rb                                                                               @getsentryultra
/config/initializers/curlybars.rb                                                                               @getsentryvikings
/config/initializers/doorman.rb                                                                               @getsentryruby-core
/config/initializers/guide_elasticsearch.rb                                                                               @getsentryguide-search
/config/initializers/importer_google_auth.rb                                                                               @getsentryvikings
/config/initializers/inflections.rb                                                                               @getsentryruby-core
/config/initializers/mime_types.rb                                                                               @getsentryruby-core
/config/initializers/mysql_read_timeout.rb                                                                               @getsentryruby-core
/config/initializers/new_framework_defaults*                                                                               @getsentryruby-core
/config/initializers/patch_zendesk_database_migrations_in_test_env.rb                                                                               @getsentryruby-core
/config/initializers/preload.rb                                                                               @getsentryruby-core
/config/initializers/reduce_timestamp_precision.rb                                                                               @getsentryruby-core
/config/initializers/rltk_patch.rb                                                                               @getsentryruby-core
/config/initializers/role.rb                                                                               @getsentryohana
/config/initializers/route_set_patch.rb                                                                               @getsentryruby-core
/config/initializers/secret_key_base.rb                                                                               @getsentryruby-core
/config/initializers/sentry.rb                                                                               @getsentryruby-core
/config/initializers/types.rb                                                                               @getsentryruby-core
/config/initializers/unicorn_timeout.rb                                                                               @getsentryruby-core
/config/routes.rb                                                                               @getsentryruby-core
/config/secrets/system_user_auth/                                                                               @getsentryruby-core
/config/unicorn_dev.rb                                                                               @getsentryruby-core
/config/unicorn_k8s.rb                                                                               @getsentryruby-core
/devspace*                                                                               @getsentryohana
/doc/events/                                                                               @getsentrypiratos
/doc/operability-reviews/requests-core-feature.md                                                                               @getsentryvikings
/integration_test/api/.ruby-version                                                                               @getsentryguide-test-engineering
/integration_test/api/Gemfile                                                                               @getsentryguide-test-engineering
/integration_test/api/Gemfile.lock                                                                               @getsentryguide-test-engineering
/integration_test/api/helpers/moderated_content_helper.rb                                                                               @getsentryultra
/integration_test/api/helpers/moderator_group_helper.rb                                                                               @getsentryultra
/integration_test/api/helpers/settings_client_helper.rb                                                                               @getsentryultra
/integration_test/api/helpers/trigger_helper.rb                                                                               @getsentryenigma
/integration_test/api/spec/gather/at_mentions_spec.rb                                                                               @getsentryultra
/integration_test/api/spec/gather/community_entities                                                                               @getsentryultra
/integration_test/api/spec/gather/content_moderation_email_spec.rb                                                                               @getsentryenigma
/integration_test/api/spec/gather/moderation/content_moderation_spec.rb                                                                               @getsentryultra
/integration_test/api/spec/gather/moderation/moderator_activities_spec.rb                                                                               @getsentryultra
/integration_test/api/spec/gather/user_profile_subscriptions_spec.rb                                                                               @getsentryultra
/integration_test/api/spec/guide_search/guide_search_spec_helper.rb                                                                               @getsentryguide-search
/integration_test/api/spec/knowledge_base/articles/attachments_spec.rb                                                                               @getsentryohana
/integration_test/api/vendor/cache/                                                                               @getsentryguide-test-engineering
/integration_test/browser/cypress/e2e/acceptance/article-comments/                                                                               @getsentryultra
/integration_test/browser/cypress/e2e/acceptance/community/                                                                               @getsentryultra
/integration_test/browser/cypress/e2e/acceptance/contributions/                                                                               @getsentryultra
/integration_test/browser/cypress/e2e/acceptance/create_and_delete*/                                                                               @getsentryultra
/integration_test/browser/cypress/e2e/acceptance/custom_pages/                                                                               @getsentryultra
/integration_test/browser/cypress/e2e/acceptance/downstream-dependencies/                                                                               @getsentryenigma
/integration_test/browser/cypress/e2e/acceptance/footer/                                                                               @getsentryvikings
/integration_test/browser/cypress/e2e/acceptance/gather-permissions/                                                                               @getsentryultra
/integration_test/browser/cypress/e2e/acceptance/recent-activity/                                                                               @getsentryenigma
/integration_test/browser/cypress/e2e/acceptance/requests/                                                                               @getsentryvikings
/integration_test/browser/cypress/e2e/acceptance/search/                                                                               @getsentryguide-search
/integration_test/browser/cypress/e2e/acceptance/sign-in/                                                                               @getsentryenigma
/integration_test/browser/cypress/e2e/acceptance/user_profiles/                                                                               @getsentryultra
/integration_test/browser/cypress/e2e/acceptance/user_roles/                                                                               @getsentryenigma
/integration_test/browser/cypress/e2e/core_features/                                                                               @getsentryguide-test-engineering
/integration_test/browser/cypress/e2e/expanded/answerbot/                                                                               @getsentryvikings
/integration_test/browser/cypress/e2e/expanded/community-badges/                                                                               @getsentryultra
/integration_test/browser/cypress/e2e/expanded/community_badges_and_aliases/                                                                               @getsentryultra
/integration_test/browser/cypress/e2e/expanded/community_pages/                                                                               @getsentryultra
/integration_test/browser/cypress/e2e/expanded/community_permissions/                                                                               @getsentryultra
/integration_test/browser/cypress/e2e/expanded/community_profiles/                                                                               @getsentryultra
/integration_test/browser/cypress/e2e/expanded/gdpr_data_deletion/                                                                               @getsentryultra
/integration_test/browser/cypress/e2e/expanded/guide_client_integration/                                                                               @getsentryohana
/integration_test/browser/cypress/e2e/expanded/guide_search/                                                                               @getsentryguide-search
/integration_test/browser/cypress/e2e/expanded/language_settings/                                                                               @getsentryohana
/integration_test/browser/cypress/e2e/expanded/malicious_content/                                                                               @getsentryultra
/integration_test/browser/cypress/e2e/expanded/multibrand/                                                                               @getsentryvikings
/integration_test/browser/cypress/e2e/expanded/navbar/                                                                               @getsentryvikings
/integration_test/browser/cypress/e2e/expanded/pagination/                                                                               @getsentryultra
/integration_test/browser/cypress/e2e/expanded/requests/                                                                               @getsentryvikings
/integration_test/browser/cypress/e2e/expanded/sections/                                                                               @getsentryenigma
/integration_test/browser/cypress/e2e/expanded/sign-in/                                                                               @getsentryvikings
/integration_test/browser/cypress/e2e/expanded/spam_management/                                                                               @getsentryenigma
/integration_test/browser/cypress/e2e/expanded/subscriptions/                                                                               @getsentryenigma
/integration_test/browser/cypress/e2e/expanded/translations/                                                                               @getsentryenigma
/integration_test/browser/cypress/e2e/expanded/user_replication/                                                                               @getsentrypiratos
/integration_test/browser/cypress/e2e/expanded/users/                                                                               @getsentryultra
/integration_test/browser/cypress/support/commands/answerBotSettings.js                                                                               @getsentryvikings
/integration_test/browser/cypress/support/commands/community-badges/helpers.js                                                                               @getsentryultra
/integration_test/browser/cypress/support/commands/customStatusesSettings.js                                                                               @getsentryvikings
/integration_test/browser/cypress/support/commands/externalContentHelper.js                                                                               @getsentryguide-search
/integration_test/browser/cypress/support/commands/guideSearchHelper.js                                                                               @getsentryguide-search
/integration_test/browser/cypress/support/commands/malwareScanningSettings.js                                                                               @getsentryvikings
/integration_test/browser/cypress/support/commands/request-list-app/                                                                               @getsentryvikings
/integration_test/browser/cypress/support/commands/user-profiles                                                                               @getsentryultra
/kubernetes/account_info_consumer.yml                                                                               @getsentryruby-core
/kubernetes/app_server.yml                                                                               @getsentryruby-core
/kubernetes/app_server_requests*                                                                               @getsentryguide-ops
/kubernetes/article_aggregated_views_consumer.yml                                                                               @getsentryguide-search
/kubernetes/at_mentions*                                                                               @getsentryultra
/kubernetes/brand_entities_consumer.yml                                                                               @getsentrypiratos
/kubernetes/community_*                                                                               @getsentryultra
/kubernetes/console.yml                                                                               @getsentryruby-core
/kubernetes/content_tag_entities_consumer.yml                                                                               @getsentryultra
/kubernetes/exodus*                                                                               @getsentryguide-search
/kubernetes/guide_article_consumer.yml                                                                               @getsentryohana
/kubernetes/products_consumer.yml                                                                               @getsentryvikings
/kubernetes/resque_scheduler.yml                                                                               @getsentryruby-core
/kubernetes/resque_worker.yml                                                                               @getsentryruby-core
/kubernetes/sync_to_guide_article_consumer.yml                                                                               @getsentryathene
/kubernetes/ticket_comment_consumer.yml                                                                               @getsentryaster
/kubernetes/tombstone_deleted_posts_consumer.yml                                                                               @getsentryultra
/kubernetes/topic_change_consumer.yml                                                                               @getsentrypiratos
/kubernetes/topic_permission_change_consumer.yml                                                                               @getsentryultra
/kubernetes/topic_removed_consumer.yml                                                                               @getsentrypiratos
/kubernetes/translation_update_consumer.yml                                                                               @getsentryohana
/kubernetes/user_deletion_request_consumer.yml                                                                               @getsentrypiratos
/kubernetes/users_consumer.yml                                                                               @getsentrypiratos
/kubernetes/users_validation_consumer.yml                                                                               @getsentrypiratos
/kubernetes/vote_change_consumer.yml                                                                               @getsentryultra
/lib/activity_log.rb                                                                               @getsentrypiratos
/lib/activity_log/                                                                               @getsentrypiratos
/lib/answer_bot/                                                                               @getsentrywaratah
/lib/article_object_id_generator.rb                                                                               @getsentrypiratos
/lib/attachment_url_rewriter.rb                                                                               @getsentryultra
/lib/caching/stale_cache.rb                                                                               @getsentryvikings
/lib/community_post_object_id_generator.rb                                                                               @getsentrypiratos
/lib/datadog_span.rb                                                                               @getsentryruby-core
/lib/domain_event_log/                                                                               @getsentrypiratos
/lib/exodus/kafka_producer.rb                                                                               @getsentryguide-search
/lib/failure_resilient_activity_log.rb                                                                               @getsentrypiratos
/lib/global_uid_error_handler.rb                                                                               @getsentryruby-core
/lib/importer_google_auth_client.rb                                                                               @getsentryvikings
/lib/middleware/doorman_account_middleware.rb                                                                               @getsentryruby-core
/lib/middleware/http_body_not_allowed_middleware.rb                                                                               @getsentryruby-core
/lib/middleware/ip_allowlist_middleware.rb                                                                               @getsentryruby-core
/lib/middleware/request_queue_time_middleware.rb                                                                               @getsentryruby-core
/lib/middleware/session_authentication_middleware.rb                                                                               @getsentryruby-core
/lib/moderation_events/                                                                               @getsentryenigma
/lib/oauth_authorization.rb                                                                               @getsentryruby-core
/lib/param_to_boolean.rb                                                                               @getsentryenigma
/lib/param_to_hash.rb                                                                               @getsentryenigma
/lib/param_to_includes.rb                                                                               @getsentryenigma
/lib/param_to_integer_id.rb                                                                               @getsentryenigma
/lib/param_to_iso8601_timestamp.rb                                                                               @getsentryenigma
/lib/protobuf/encoders/platform/                                                                               @getsentrypiratos
/lib/protobuf/encoders/protobuf_account_partitioned_key_encoder.rb                                                                               @getsentryultra
/lib/query/cursor_based_pagination/                                                                               @getsentryenigma
/lib/query/local_user.rb                                                                               @getsentrypiratos
/lib/relative_url_rewriter.rb                                                                               @getsentryenigma
/lib/rubocop/                                                                               @getsentryruby-core
/lib/search/                                                                               @getsentryguide-search
/lib/system_user_authorization.rb                                                                               @getsentryruby-core
/lib/theming_center_api_connection.rb                                                                               @getsentryvikings
/lib/theming_templates_helper.rb                                                                               @getsentryvikings
/lib/theming_templates_processor.rb                                                                               @getsentryvikings
/lib/user_role_resolver.rb                                                                               @getsentrypiratos
/lib/valid_locale.rb                                                                               @getsentryruby-core
/lib/warden/doorman_basic_warden_strategy.rb                                                                               @getsentryruby-core
/lib/warden/doorman_oauth_warden_strategy.rb                                                                               @getsentryruby-core
/lib/warden/doorman_system_user_warden_strategy.rb                                                                               @getsentryruby-core
/lib/word_filter.rb                                                                               @getsentryenigma
/openapi/docs/operations/ArticleSearch.md                                                                               @getsentryguide-search
/openapi/docs/operations/CommunityPostSearch.md                                                                               @getsentryguide-search
/openapi/docs/operations/UnifiedSearch.md                                                                               @getsentryguide-search
/openapi/docs/tags/Search.md                                                                               @getsentryguide-search
/openapi/docs/tags/User_Images.md                                                                               @getsentryultra
/openapi/examples/CreateUserImageResponseExample.yaml                                                                               @getsentryultra
/openapi/examples/RequestUserImageUploadResponseExample.yaml                                                                               @getsentryultra
/openapi/examples/UnifiedSearchResponseExample.yaml                                                                               @getsentryguide-search
/openapi/paths/v2/community/*                                                                               @getsentryultra
/openapi/paths/v2/help_center/help_center_articles_search.yaml                                                                               @getsentryguide-search
/openapi/paths/v2/help_center/help_center_community_posts_search.yaml                                                                               @getsentryguide-search
/openapi/paths/v2/help_center/help_center_translations_by_translation_id.yaml                                                                               @getsentryenigma
/openapi/paths/v2/help_center/unified_search.yaml                                                                               @getsentryguide-search
/openapi/schemas/CreateUserImageResponse.yaml                                                                               @getsentryultra
/openapi/schemas/RequestUserImageUploadResponse.yaml                                                                               @getsentryultra
/openapi/schemas/UnifiedSearchResult.yaml                                                                               @getsentryguide-search
/openapi/schemas/UnifiedSearchResultSet.yaml                                                                               @getsentryguide-search
/platform-data-graph.yml                                                                               @getsentryone-graph
/schemas/help_center/domain/community/                                                                               @getsentryultra
/script/bundle                                                                               @getsentryruby-core
/script/ci-failures                                                                               @getsentryruby-core
/script/i18n/                                                                               @getsentryruby-core
/script/lint-markdown.rb                                                                               @getsentryruby-core
/script/rubocop-excludes-check.rb                                                                               @getsentryruby-core
/script/update-dev-test-gems.rb                                                                               @getsentryruby-core
/script/update-integration-test-gems.sh                                                                               @getsentryruby-core
/spec/*_helper.rb                                                                               @getsentryruby-core
/spec/api/clean_params_on_error_spec.rb                                                                               @getsentryenigma
/spec/api/internal/recent_activity_spec.rb                                                                               @getsentryenigma
/spec/api/mobile/*                                                                               @getsentryenigma
/spec/api/v2/locale_parameter_validation_spec.rb                                                                               @getsentryenigma
/spec/backfills/account_unpublish_backfill_spec.rb                                                                               @getsentryguide-search
/spec/backfills/article_missing_archive_event_backfill_spec.rb                                                                               @getsentryohana
/spec/backfills/delete_bad_snapshots_spec.rb                                                                               @getsentryohana
/spec/backfills/guide_article_archived_backfill_spec.rb                                                                               @getsentryathene
/spec/backfills/kb_event_body_backfill_spec.rb                                                                               @getsentryohana
/spec/backfills/missing_article_delete_event_backfill_spec.rb                                                                               @getsentryenigma
/spec/backfills/restore_z2_content_backfill_spec.rb                                                                               @getsentryenigma
/spec/backfills/retrieve_article_spec.rb                                                                               @getsentryohana
/spec/backfills/unused_attachment_removal_backfill_spec.rb                                                                               @getsentryohana
/spec/consumers/account_info_consumer/*                                                                               @getsentrypiratos
/spec/consumers/account_info_consumer_spec.rb                                                                               @getsentrypiratos
/spec/consumers/article_export/article_aggregated_views_consumer_spec.rb                                                                               @getsentryguide-search
/spec/consumers/brands/*                                                                               @getsentrypiratos
/spec/consumers/community_*                                                                               @getsentryultra
/spec/consumers/content_tag_entities_consumer_spec.rb                                                                               @getsentryultra
/spec/consumers/exodus/                                                                               @getsentryguide-search
/spec/consumers/protobuf_parser_spec.rb                                                                               @getsentryohana
/spec/consumers/reusable_content/article_*.rb                                                                               @getsentryohana
/spec/consumers/reusable_content/guide_*.rb                                                                               @getsentryohana
/spec/consumers/reusable_content/sync_to_guide_article_consumer_spec.rb                                                                               @getsentryathene
/spec/consumers/reusable_content/timestamp_*.rb                                                                               @getsentryohana
/spec/consumers/reusable_content/translation_*.rb                                                                               @getsentryohana
/spec/consumers/ticket_comment_consumer/                                                                               @getsentryaster                                                                               @getsentryenigma
/spec/consumers/user_deletion_request_consumer_spec.rb                                                                               @getsentrypiratos
/spec/consumers/users/*                                                                               @getsentrypiratos
/spec/consumers/users_consumer_spec.rb                                                                               @getsentrypiratos
/spec/consumers/users_validation_consumer_spec.rb                                                                               @getsentrypiratos
/spec/controllers/account_data_deletion_controller_spec.rb                                                                               @getsentryguide-search
/spec/controllers/answer_bot/                                                                               @getsentrywaratah
/spec/controllers/api/internal/community_enabled_controller_spec.rb                                                                               @getsentryultra
/spec/controllers/api/internal/deflection_controller_spec.rb                                                                               @getsentryguide-search
/spec/controllers/api/internal/theming/                                                                               @getsentryvikings
/spec/controllers/api/mobile/single_article_controller_spec.rb                                                                               @getsentryenigma
/spec/controllers/api/v2/articles/stats_view_controller_spec.rb                                                                               @getsentrypiratos
/spec/controllers/concerns/activity_logging_spec.rb                                                                               @getsentrypiratos
/spec/controllers/concerns/controller_patches_spec.rb                                                                               @getsentryruby-core
/spec/controllers/concerns/permit_only_spec.rb                                                                               @getsentryenigma
/spec/controllers/custom_pages_controller_spec.rb                                                                               @getsentryultra
/spec/controllers/root_controller_spec.rb                                                                               @getsentryvikings
/spec/experiments/local_user_experiment_spec.rb                                                                               @getsentrypiratos
/spec/fixtures/i+mage.png                                                                               @getsentryohana
/spec/forms/api/update_article_attachments_form_spec.rb                                                                               @getsentryohana
/spec/forms/community_*                                                                               @getsentryultra
/spec/graph/entities_spec.rb                                                                               @getsentryone-graph
/spec/graph/types/general_settings_mutation_spec.rb                                                                               @getsentryenigma
/spec/graph/types/pages/federated_search_spec.rb                                                                               @getsentryguide-search
/spec/helpers/content_tag/*                                                                               @getsentryultra
/spec/helpers/protobuf_helper.rb                                                                               @getsentryohana
/spec/helpers/query_commenter_spec.rb                                                                               @getsentryruby-core
/spec/helpers/reusable_content/*                                                                               @getsentryohana
/spec/helpers/search_caching_helper_spec.rb                                                                               @getsentryguide-search
/spec/jobs/community_*                                                                               @getsentryultra
/spec/jobs/exodus/                                                                               @getsentryguide-search
/spec/lib/activity_log/                                                                               @getsentrypiratos
/spec/lib/answer_bot/                                                                               @getsentrywaratah
/spec/lib/attachment_url_rewriter_spec.rb                                                                               @getsentryenigma
/spec/lib/caching/stale_cache_spec.rb                                                                               @getsentryvikings
/spec/lib/domain_event_log/                                                                               @getsentrypiratos
/spec/lib/failure_resilient_activity_log_spec.rb                                                                               @getsentrypiratos
/spec/lib/middleware/ip_allowlist_middleware_spec.rb                                                                               @getsentryruby-core
/spec/lib/middleware/request_queue_time_middleware_spec.rb                                                                               @getsentryruby-core
/spec/lib/middleware_stack_spec.rb                                                                               @getsentryruby-core
/spec/lib/param_to_boolean_spec.rb                                                                               @getsentryenigma
/spec/lib/param_to_hash_spec.rb                                                                               @getsentryenigma
/spec/lib/param_to_includes_spec.rb                                                                               @getsentryenigma
/spec/lib/param_to_integer_id_spec.rb                                                                               @getsentryenigma
/spec/lib/param_to_iso8601_timestamp_spec.rb                                                                               @getsentryenigma
/spec/lib/protobuf/encoders/platform/standard/                                                                               @getsentrypiratos
/spec/lib/protobuf/encoders/protobuf_account_partitioned_key_encoder_spec.rb                                                                               @getsentryultra
/spec/lib/relative_url_rewriter_spec.rb                                                                               @getsentryenigma
/spec/lib/rubocop/                                                                               @getsentryruby-core
/spec/lib/system_backend_spec.rb                                                                               @getsentryenigma
/spec/lib/theming_templates_helper_spec.rb                                                                               @getsentryvikings
/spec/lib/user_role_resolver_spec.rb                                                                               @getsentrypiratos
/spec/lib/warden_strategies_spec.rb                                                                               @getsentryruby-core
/spec/mailers/community_*.rb                                                                               @getsentryultra
/spec/models/account_info_spec.rb                                                                               @getsentrypiratos
/spec/models/answer_bot/                                                                               @getsentrywaratah
/spec/models/community_content/mentionable_users_spec.rb                                                                               @getsentryultra
/spec/models/community_content/remove_id_class_step_spec.rb                                                                               @getsentryultra
/spec/models/community_content_spec.rb                                                                               @getsentryultra
/spec/models/concerns/alternate_template_spec.rb                                                                               @getsentryenigma
/spec/models/content_moderation/                                                                               @getsentryultra
/spec/models/content_tag_spec.rb                                                                               @getsentryultra
/spec/models/exodus/                                                                               @getsentryguide-search
/spec/models/general_settings_updater_spec.rb                                                                               @getsentryultra
/spec/models/guide_search/                                                                               @getsentryguide-search
/spec/models/knowledge/article_command/add_translation_spec.rb                                                                               @getsentryenigma
/spec/models/knowledge/article_command/bulk_archive_spec.rb                                                                               @getsentryenigma
/spec/models/knowledge/article_command/bulk_publish_translation_spec.rb                                                                               @getsentryenigma
/spec/models/knowledge/article_command/bulk_remove_spec.rb                                                                               @getsentryenigma
/spec/models/knowledge/article_command/bulk_restore_spec.rb                                                                               @getsentryenigma
/spec/models/knowledge/article_command/bulk_restrict_viewing_spec.rb                                                                               @getsentryenigma
/spec/models/knowledge/article_command/bulk_unrestrict_viewing_spec.rb                                                                               @getsentryenigma
/spec/models/knowledge/article_command/bulk_withdraw_translation_spec.rb                                                                               @getsentryenigma
/spec/models/knowledge/article_command/create_spec.rb                                                                               @getsentryenigma
/spec/models/knowledge/article_command/publish_translation_spec.rb                                                                               @getsentryenigma
/spec/models/knowledge/article_command/publish_translation_v3_spec.rb                                                                               @getsentryenigma
/spec/models/knowledge/article_command/restore_spec.rb                                                                               @getsentryenigma
/spec/models/knowledge/article_command/update_translation_spec.rb                                                                               @getsentryenigma
/spec/models/knowledge/article_command/withdraw_translation_spec.rb                                                                               @getsentryenigma
/spec/models/knowledge/article_command/withdraw_translation_v3_spec.rb                                                                               @getsentryenigma
/spec/models/knowledge/translation_body_resolver_spec.rb                                                                               @getsentryohana
/spec/models/last_search_storage_spec.rb                                                                               @getsentrypiratos
/spec/models/local_user_spec.rb                                                                               @getsentrypiratos
/spec/models/post_content_tagging_spec.rb                                                                               @getsentryultra
/spec/presenters/hbs/content_tag_presenter_spec.rb                                                                               @getsentryultra                                                                               @getsentryvikings
/spec/presenters/hbs/custom_pages/show_presenter_spec.rb                                                                               @getsentryenigma
/spec/presenters/hbs/helpers/contact_details_helper_spec.rb                                                                               @getsentryultra
/spec/queries/federated_search_query_spec.rb                                                                               @getsentryguide-search
/spec/renderers/answer_bot_article_renderer_spec.rb                                                                               @getsentrywaratah
/spec/renderers/article_renderer_sanitization_spec.rb                                                                               @getsentryenigma
/spec/renderers/article_renderer_spec.rb                                                                               @getsentryenigma
/spec/renderers/text_html_renderer_spec.rb                                                                               @getsentryenigma
/spec/requests/admin/category_spec.rb                                                                               @getsentryenigma
/spec/requests/articles/visibility_spec.rb                                                                               @getsentryenigma
/spec/requests/articles_spec.rb                                                                               @getsentryenigma
/spec/requests/authorization_spec.rb                                                                               @getsentryruby-core
/spec/requests/categories_spec.rb                                                                               @getsentryenigma
/spec/requests/params_check_spec.rb                                                                               @getsentryruby-core
/spec/requests/response_headers_spec.rb                                                                               @getsentryruby-core
/spec/requests/root_access_spec.rb                                                                               @getsentryvikings
/spec/requests/sections_spec.rb                                                                               @getsentryenigma
/spec/serializers/api/internal/answer_bot/                                                                               @getsentrywaratah
/spec/serializers/api/internal/arrange_articles/                                                                               @getsentryenigma
/spec/services/article_exporter*                                                                               @getsentryenigma
/spec/services/article_exporter/article_standard_object_publisher_spec.rb                                                                               @getsentrypiratos
/spec/services/community_post_exporter/                                                                               @getsentrypiratos
/spec/statistics/content/                                                                               @getsentryohana
/spec/support/                                                                               @getsentryruby-core
/spec/support/exodus_support.rb                                                                               @getsentryguide-search
/spec/support/fake_search_query_builder.rb                                                                               @getsentryguide-search
/ui/components/AnswerBotModal                                                                               @getsentrywaratah
/ui/components/AnswerBotModalV2                                                                               @getsentrywaratah
/ui/components/ApproveCommentModal/                                                                               @getsentryultra
/ui/components/ApproveContentModal/                                                                               @getsentryultra
/ui/components/ApprovePostModal/                                                                               @getsentryultra
/ui/components/BadgeAssignmentsModal/                                                                               @getsentryultra
/ui/components/BadgeAssignmentsModalV2/                                                                               @getsentryultra
/ui/components/ChangePasswordModalV2/                                                                               @getsentryultra
/ui/components/CommentActions/                                                                               @getsentryultra
/ui/components/ContactDetailsModal/                                                                               @getsentryultra
/ui/components/ContentTagSelect/                                                                               @getsentryultra
/ui/components/EditCommentModal/                                                                               @getsentryultra
/ui/components/EditPostModal/                                                                               @getsentryultra
/ui/components/EditProfileModal/                                                                               @getsentryultra
/ui/components/EditProfileModalV2/                                                                               @getsentryultra
/ui/components/EditorMentions/                                                                               @getsentryultra
/ui/components/Gap/                                                                               @getsentryultra
/ui/components/HCThemeProvider/index.js                                                                               @getsentryultra
/ui/components/ModalDialog/index.js                                                                               @getsentryultra
/ui/components/MovePostModal/                                                                               @getsentryultra
/ui/components/MovePostModalV2/                                                                               @getsentryultra
/ui/components/PostActions/                                                                               @getsentryultra
/ui/components/UserProfileActions/                                                                               @getsentryultra
/ui/components/Wysiwyg/                                                                               @getsentryultra
/ui/components/admin/GeneralSettings/components/Requests/                                                                               @getsentryvikings
/ui/javascripts/admin/modules/ArrangeTopics/                                                                               @getsentryultra
/ui/javascripts/admin/views/Topic/                                                                               @getsentryultra
/ui/javascripts/enduser/modules/answerBotModal/                                                                               @getsentryvikings
/ui/javascripts/enduser/modules/bootstrapNestedDropdowns/                                                                               @getsentryvikings
/ui/javascripts/enduser/modules/commentActions/                                                                               @getsentryultra
/ui/javascripts/enduser/modules/conditionalFields/                                                                               @getsentryboxoffice                                                                               @getsentryvikings
/ui/javascripts/enduser/modules/contentTagsSelector/                                                                               @getsentryultra
/ui/javascripts/enduser/modules/datepicker/                                                                               @getsentryvikings
/ui/javascripts/enduser/modules/emailPills/                                                                               @getsentryvikings
/ui/javascripts/enduser/modules/multiselect/                                                                               @getsentryvikings
/ui/javascripts/enduser/modules/postActions/                                                                               @getsentryultra
/ui/javascripts/enduser/modules/prefillRequestFields/                                                                               @getsentryvikings
/ui/javascripts/enduser/modules/upload/                                                                               @getsentryvikings
/ui/javascripts/enduser/modules/userProfileActions/                                                                               @getsentryultra
/ui/javascripts/enduser/modules/wysiwyg/                                                                               @getsentryultra
/ui/javascripts/enduser/views/NewPost/                                                                               @getsentryultra
/ui/javascripts/enduser/views/NewRequest/                                                                               @getsentryvikings
/ui/javascripts/enduser/views/OrganizationRequests/                                                                               @getsentryvikings
/ui/javascripts/enduser/views/Post/                                                                               @getsentryultra
/ui/javascripts/enduser/views/Posts/                                                                               @getsentryultra
/ui/javascripts/enduser/views/Request/                                                                               @getsentryvikings
/ui/javascripts/enduser/views/Requests/                                                                               @getsentryvikings
/ui/javascripts/enduser/views/Topic/                                                                               @getsentryultra
/ui/javascripts/enduser/views/UserProfile/                                                                               @getsentryultra
/ui/javascripts/libs/embeddables/answerBot.js                                                                               @getsentrywaratah                                                                               @getsentryvikings
/ui/javascripts/libs/embeddables/answerBot.spec.js                                                                               @getsentrywaratah                                                                               @getsentryvikings
/ui/javascripts/libs/externallyHostedImageDetector/                                                                               @getsentryultra
/ui/javascripts/libs/suncoWidget/                                                                               @getsentryohana
/ui/javascripts/mobile.js                                                                               @getsentryvikings
/ui/javascripts/mobile/                                                                               @getsentryvikings
/ui/stylesheets/help_center/helpers/_autocomplete.scss                                                                               @getsentryultra
/ui/stylesheets/help_center/helpers/_email-pills.scss                                                                               @getsentryvikings
/ui/stylesheets/help_center/helpers/_mention.scss                                                                               @getsentryultra
/ui/stylesheets/help_center/helpers/_multiselect.scss                                                                               @getsentryvikings
/ui/stylesheets/help_center/helpers/_uploads-attachments.scss                                                                               @getsentryvikings
/ui/stylesheets/help_center/helpers/_uploads-dropzone.scss                                                                               @getsentryvikings
/ui/stylesheets/mobile.scss                                                                               @getsentryvikings
/ui/stylesheets/mobile/                                                                               @getsentryvikings
/ui/stylesheets/theming_v1_support.scss                                                                               @getsentryvikings
/ui/stylesheets/vendor/_pikaday-hc.scss                                                                               @getsentryvikings
/ui/stylesheets/vendor/_pikaday.scss                                                                               @getsentryvikings
/ui/stylesheets/vendor/_wysiwyg-icons.scss                                                                               @getsentryultra
/ui/utils/graphql.js                                                                               @getsentryultra
/vendor/cache*/actioncable-*.gem                                                                               @getsentryruby-core
/vendor/cache*/actionmailer-*.gem                                                                               @getsentryruby-core
/vendor/cache*/actionpack-*.gem                                                                               @getsentryruby-core
/vendor/cache*/actionview-*.gem                                                                               @getsentryruby-core
/vendor/cache*/active_record-comments-*.gem                                                                               @getsentryruby-core
/vendor/cache*/active_record_host_pool-*.gem                                                                               @getsentryruby-core
/vendor/cache*/active_record_shards-*.gem                                                                               @getsentryruby-core
/vendor/cache*/activejob-*.gem                                                                               @getsentryruby-core
/vendor/cache*/activemodel-*.gem                                                                               @getsentryruby-core
/vendor/cache*/activerecord-*.gem                                                                               @getsentryruby-core
/vendor/cache*/activestorage-*.gem                                                                               @getsentryruby-core
/vendor/cache*/activesupport-*.gem                                                                               @getsentryruby-core
/vendor/cache*/better_errors-*.gem                                                                               @getsentryruby-core
/vendor/cache*/binding_of_caller-*.gem                                                                               @getsentryruby-core
/vendor/cache*/bootsnap-*.gem                                                                               @getsentryruby-core
/vendor/cache*/concurrent-ruby-*.gem                                                                               @getsentryruby-core
/vendor/cache*/dalli-*.gem                                                                               @getsentryruby-core
/vendor/cache*/dalli-elasticache-*.gem                                                                               @getsentryruby-core
/vendor/cache*/debug_inspector-*.gem                                                                               @getsentryruby-core
/vendor/cache*/diff-lcs-*.gem                                                                               @getsentryruby-core
/vendor/cache*/dotenv-*.gem                                                                               @getsentryruby-core
/vendor/cache*/fuubar-*.gem                                                                               @getsentryruby-core
/vendor/cache*/global_uid-*.gem                                                                               @getsentryruby-core
/vendor/cache*/hashdiff-*.gem                                                                               @getsentryruby-core
/vendor/cache*/mysql2-*.gem                                                                               @getsentryruby-core
/vendor/cache*/parser-*.gem                                                                               @getsentryruby-core
/vendor/cache*/query_matchers-*.gem                                                                               @getsentryruby-core
/vendor/cache*/rack-*.gem                                                                               @getsentryruby-core
/vendor/cache*/rack-utf8_sanitizer-*.gem                                                                               @getsentryruby-core
/vendor/cache*/rails-*.gem                                                                               @getsentryruby-core
/vendor/cache*/railties-*.gem                                                                               @getsentryruby-core
/vendor/cache*/rainbow-*.gem                                                                               @getsentryruby-core
/vendor/cache*/rake-*.gem                                                                               @getsentryruby-core
/vendor/cache*/regexp_parser-*.gem                                                                               @getsentryruby-core
/vendor/cache*/rspec-*.gem                                                                               @getsentryruby-core
/vendor/cache*/rspec-core-*.gem                                                                               @getsentryruby-core
/vendor/cache*/rspec-expectations-*.gem                                                                               @getsentryruby-core
/vendor/cache*/rspec-mocks-*.gem                                                                               @getsentryruby-core
/vendor/cache*/rspec-rails-*.gem                                                                               @getsentryruby-core
/vendor/cache*/rspec-support-*.gem                                                                               @getsentryruby-core
/vendor/cache*/rubocop-*.gem                                                                               @getsentryruby-core
/vendor/cache*/ruby-progressbar-*.gem                                                                               @getsentryruby-core
/vendor/cache*/sprockets-*.gem                                                                               @getsentryruby-core
/vendor/cache*/sprockets-rails-*.gem                                                                               @getsentryruby-core
/vendor/cache*/timecop-*.gem                                                                               @getsentryruby-core
/vendor/cache*/unicode-display_width-*.gem                                                                               @getsentryruby-core
/vendor/cache*/unicorn-*.gem                                                                               @getsentryruby-core
/vendor/cache*/vcr-*.gem                                                                               @getsentryruby-core
/vendor/cache*/webmock-*.gem                                                                               @getsentryruby-core
/vendor/cache*/zendesk_database_support-*.gem                                                                               @getsentryruby-core
/vendor/cache*/zendesk_oauth-*.gem                                                                               @getsentryruby-core
/vendor/cache*/zombie_record-*.gem                                                                               @getsentryruby-core
/vendor/plugins/bootboot-*/                                                                               @getsentryruby-core
"""
