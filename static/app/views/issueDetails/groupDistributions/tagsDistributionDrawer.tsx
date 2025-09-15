import {Fragment, useState} from 'react';

import {Button} from 'sentry/components/core/button';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import {Tooltip} from 'sentry/components/core/tooltip';
import {
  EventDrawerBody,
  EventNavigator,
  EventStickyControls,
} from 'sentry/components/events/eventDrawer';
import SuspectTable from 'sentry/components/issues/suspect/suspectTable';
import {IconSort} from 'sentry/icons';
import type {Group} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useParams} from 'sentry/utils/useParams';
import GroupDistributionsSearchInput from 'sentry/views/issueDetails/groupDistributions/groupDistributionsSearchInput';
import HeaderTitle from 'sentry/views/issueDetails/groupDistributions/headerTitle';
import TagExportDropdown from 'sentry/views/issueDetails/groupDistributions/tagExportDropdown';
import TagFlagPicker from 'sentry/views/issueDetails/groupDistributions/tagFlagPicker';
import {DrawerTab} from 'sentry/views/issueDetails/groupDistributions/types';
import {TagDetailsDrawerContent} from 'sentry/views/issueDetails/groupTags/tagDetailsDrawerContent';
import TagDrawerContent from 'sentry/views/issueDetails/groupTags/tagDrawerContent';
import {useEnvironmentsFromUrl} from 'sentry/views/issueDetails/utils';

interface Props {
  group: Group;
  includeFeatureFlagsTab: boolean;
  organization: Organization;
  project: Project;
  setTab: (value: DrawerTab) => void;
}

export default function TagsDistributionDrawer({
  group,
  organization,
  project,
  setTab,
  includeFeatureFlagsTab,
}: Props) {
  const environments = useEnvironmentsFromUrl();
  const {tagKey} = useParams<{tagKey: string}>();

  // If we're showing the suspect section at all
  const enableSuspectFlags = organization.features.includes('feature-flag-suspect-flags');

  const [search, setSearch] = useState('');

  return (
    <Fragment>
      <EventNavigator>
        <HeaderTitle
          tagKey={tagKey}
          tab={DrawerTab.TAGS}
          includeFeatureFlagsTab={includeFeatureFlagsTab}
        />

        {tagKey ? (
          <TagExportDropdown
            organization={organization}
            project={project}
            group={group}
            tagKey={tagKey}
          />
        ) : null}
      </EventNavigator>
      <EventDrawerBody>
        {!tagKey && enableSuspectFlags ? (
          <SuspectTable environments={environments} group={group} />
        ) : null}

        {tagKey ? null : (
          <EventStickyControls>
            {includeFeatureFlagsTab ? (
              <TagFlagPicker setTab={setTab} tab={DrawerTab.TAGS} />
            ) : (
              <div />
            )}

            <ButtonBar>
              <GroupDistributionsSearchInput
                includeFeatureFlagsTab={includeFeatureFlagsTab}
                search={search}
                onChange={value => {
                  setSearch(value);
                  trackAnalytics('tags.drawer.action', {
                    control: 'search',
                    organization,
                  });
                }}
              />
              {includeFeatureFlagsTab ? (
                <Fragment>
                  <Tooltip title="Highlighted tags are shown first">
                    <Button aria-label="" disabled size="xs" icon={<IconSort />} />
                  </Tooltip>
                </Fragment>
              ) : null}
            </ButtonBar>
          </EventStickyControls>
        )}

        {tagKey ? (
          <TagDetailsDrawerContent group={group} />
        ) : (
          <TagDrawerContent
            group={group}
            environments={environments}
            organization={organization}
            project={project}
            search={search}
          />
        )}
      </EventDrawerBody>
    </Fragment>
  );
}
