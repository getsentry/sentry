#!/bin/bash

echo "Trying to colocate tests"

# Regex to capture to filepath
regex="tests/js/spec/(.+)"
# Loop through all the directories in tests/js/spec
for dir in eval `find tests/js/spec -type d`; do
    if [[ $dir =~ $regex ]]
    then
        # get the path of the subfolder
        name="${BASH_REMATCH[1]}"
        # see if a similar path exists in the app
        if [[ ! -d "static/app/$name" ]] ;
        then
            echo "path corresponding to $name not found, manually move tests please..."
            continue
        else
            # if that path exists, move test files into that path
            for file in $dir/*; do
                # ignore directories & only move files if they don't exist in destination
                [ -f "$file" ] && mv -n "$file" "static/app/$name/"
            done
        fi
    fi
done

# remove empty folders
eval "$(find tests/js/spec -empty -delete)"

# mv tests/js/spec/utils/settings/notifications/backfill.spec.tsx static/app/views/settings/account/notifications/
# mv tests/js/spec/utils/settings/notifications/testUtils.spec.tsx static/app/views/settings/account/notifications/
# mv tests/js/spec/components/sidebar/sidebarDrodown/index.spec.jsx static/app/components/sidebar/sidebarDropdown/
# mv tests/js/spec/components/events/interfaces/debugMeta-v2/utils.spec.tsx static/app/components/events/interfaces/debugMeta/
# mv tests/js/spec/components/events/interfaces/debugMeta-v2/imageDetailsCandidates.spec.tsx static/app/components/events/interfaces/debugMeta/debugImageDetails/
# mv tests/js/spec/views/settings/projectKeys/list/index.spec.jsx static/app/views/settings/project/projectKeys/list/
# mv tests/js/spec/views/settings/projectKeys/details/index.spec.jsx static/app/views/settings/project/projectKeys/details/
# mv tests/js/spec/views/dashboardsV2/widgetBuilder/metricWidget/fields.spec.tsx static/app/views/dashboardsV2/widgetBuilder/releaseWidget/

# # mkdir static/app/views/dashboardsV2/deprecated/
# # mv static/app/views/dashboardsV2/detail.spec.jsx static/app/views/dashboardsV2/deprecated/detail.spec.jsx
# # mv static/app/views/dashboardsV2/dashboard.spec.tsx static/app/views/dashboardsV2/deprecated/dashboard.spec.tsx

# mv tests/js/spec/views/dashboardsV2/gridLayout/detail.spec.jsx static/app/views/dashboardsV2/
# mv tests/js/spec/views/dashboardsV2/gridLayout/create.spec.tsx static/app/views/dashboardsV2/
# mv tests/js/spec/views/dashboardsV2/gridLayout/dashboard.spec.tsx static/app/views/dashboardsV2/
# mv tests/js/spec/views/dashboardsV2/gridLayout/layoutUtils.spec.tsx static/app/views/dashboardsV2/

# mv tests/js/spec/views/alerts/issueRules/* static/app/views/alerts/rules/issue/

# mv tests/js/spec/views/alerts/details/* static/app/views/alerts/rules/issue/details/

# mv tests/js/spec/views/alerts/metricRules/* static/app/views/alerts/rules/metric/

# mv tests/js/spec/views/performance/transactionVitals/utils.spec.jsx static/app/views/performance/transactionSummary/transactionVitals/
# mv tests/js/spec/views/performance/transactionTags/index.spec.tsx static/app/views/performance/transactionSummary/transactionTags/
# mv tests/js/spec/views/performance/transactionSpans/* static/app/views/performance/transactionSummary/transactionSpans/
# mv tests/js/spec/views/performance/transactionAnomalies/index.spec.tsx static/app/views/performance/transactionSummary/transactionAnomalies/

# mv tests/js/spec/views/team/teamSettings.spec.jsx static/app/views/settings/organizationTeams/teamSettings/
# mv tests/js/spec/views/team/* static/app/views/settings/organizationTeams/

# mv tests/js/spec/views/projectPlugins/* static/app/views/settings/projectPlugins/

# mv tests/js/spec/views/projectSecurityHeaders/* static/app/views/settings/projectSecurityHeaders/

# mv static/app/views/settings/accountSettingsLayout.spec.jsx static/app/views/settings/account/accountSettingsLayout.spec.jsx

# mv static/app/views/settings/auditLogView.spec.jsx static/app/views/settings/organizationAuditLog/
# mv static/app/views/settings/organizationAuditLog.spec.jsx static/app/views/settings/organizationAuditLog/

# mv static/app/views/settings/organizationApiKeyDetailsView.spec.jsx static/app/views/settings/organizationApiKeys
# mv static/app/views/settings/organizationApiKeysList.spec.jsx static/app/views/settings/organizationApiKeys
# mv static/app/views/settings/organizationApiKeysView.spec.jsx static/app/views/settings/organizationApiKeys

# mv static/app/views/settings/organizationAuthList.spec.jsx static/app/views/settings/organizationAuth

# mv static/app/views/settings/organizationProjects.spec.jsx static/app/views/settings/organizationProjects

# mv static/app/views/settings/organizationRateLimits.spec.jsx static/app/views/settings/organizationRateLimits

# mv static/app/views/settings/organizationRepositories.spec.jsx static/app/views/settings/organizationRepositories
# mv static/app/views/settings/organizationRepositoriesContainer.spec.jsx static/app/views/settings/organizationRepositories

# mv static/app/views/settings/organizationSecurityAndPrivacy.spec.jsx static/app/views/settings/organizationSecurityAndPrivacy

# mv static/app/views/settings/organizationSettingsForm.spec.jsx static/app/views/settings/organizationGeneralSettings

# mv static/app/views/settings/organizationTeams.spec.jsx static/app/views/settings/organizationTeams
# mv static/app/views/settings/projectEnvironments.spec.jsx static/app/views/settings/project
# mv static/app/views/settings/projectPerformance.spec.jsx static/app/views/settings/projectPerformance
# mv static/app/views/settings/projectReleaseTracking.spec.jsx static/app/views/settings/project
# mv static/app/views/settings/projectSecurityAndPrivacy.spec.tsx static/app/views/settings/projectSecurityAndPrivacy
# mv static/app/views/settings/projectSourceMaps.spec.jsx static/app/views/settings/projectSourceMaps
# mv static/app/views/settings/projectUserFeedback.spec.jsx static/app/views/settings/project


# mv static/app/views/accountAuthorization.spec.jsx static/app/views/settings/account
# mv static/app/views/accountClose.spec.jsx static/app/views/settings/account
# mv static/app/views/accountDetail.spec.jsx static/app/views/settings/account
# mv static/app/views/accountEmails.spec.jsx static/app/views/settings/account
# mv static/app/views/accountIdentities.spec.jsx static/app/views/settings/account
# mv static/app/views/accountSubscriptions.spec.jsx static/app/views/settings/account

# mv static/app/views/accountSecurity.spec.jsx static/app/views/settings/account/accountSecurity
# mv static/app/views/accountSecurityDetails.spec.jsx static/app/views/settings/account/accountSecurity
# mv static/app/views/accountSecurityEnroll.spec.jsx static/app/views/settings/account/accountSecurity
# mv static/app/views/accountSecuritySessionHistory.spec.jsx static/app/views/settings/account/accountSecurity

# mv static/app/views/apiNewToken.spec.jsx static/app/views/settings/account
# mv static/app/views/apiTokenRow.spec.tsx static/app/views/settings/account
# mv static/app/views/apiTokens.spec.jsx static/app/views/settings/account

# mv static/app/views/addCodeOwnerModal.spec.jsx static/app/views/settings/project/projectOwnership
# mv static/app/views/app.spec.jsx static/app/views/app

# mv static/app/views/ownershipInput.spec.jsx static/app/views/settings/project/projectOwnership
# mv static/app/views/passwordForm.spec.jsx static/app/views/settings/account

# mv static/app/views/projectFilters.spec.jsx static/app/views/settings/project/projectFilters
# mv static/app/views/projectOwnership.spec.jsx static/app/views/settings/project/projectOwnership
# mv static/app/views/projectPluginDetails.spec.jsx static/app/views/settings/projectPlugins
# mv static/app/views/projectTags.spec.jsx static/app/views/settings/
# mv static/app/views/projectTeams.spec.jsx static/app/views/settings/project

# mv static/app/views/providerItem.spec.jsx static/app/views/settings/organizationAuth

# mv static/app/views/ruleBuilder.spec.jsx static/app/views/settings/project/projectOwnership
# mv static/app/views/twoFactorRequired.spec.jsx static/app/views/settings/account/accountSecurity
