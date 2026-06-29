import {Fragment, useState} from 'react';

import {Button} from '@sentry/scraps/button';
import {Grid} from '@sentry/scraps/layout';
import {Tooltip} from '@sentry/scraps/tooltip';

import {
  EventDrawerBody,
  EventNavigator,
  Header,
} from 'sentry/components/events/eventDrawer';
import {IconSort} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useParams} from 'sentry/utils/useParams';
import {GroupDistributionsSearchInput} from 'sentry/views/issueDetails/groupDistributions/groupDistributionsSearchInput';
import {TagExportDropdown} from 'sentry/views/issueDetails/groupDistributions/tagExportDropdown';
import {TagFlagPicker} from 'sentry/views/issueDetails/groupDistributions/tagFlagPicker';
import {DrawerTab} from 'sentry/views/issueDetails/groupDistributions/types';
import {TagDetailsDrawerContent} from 'sentry/views/issueDetails/groupTags/tagDetailsDrawerContent';
import {TagDrawerContent} from 'sentry/views/issueDetails/groupTags/tagDrawerContent';
import {useEnvironmentsFromUrl} from 'sentry/views/issueDetails/utils';

interface Props {
  group: Group;
  includeFeatureFlagsTab: boolean;
  organization: Organization;
  project: Project;
  setTab: (value: DrawerTab) => void;
}

export function TagsDistributionDrawer({
  group,
  organization,
  project,
  setTab,
  includeFeatureFlagsTab,
}: Props) {
  const environments = useEnvironmentsFromUrl();
  const {tagKey} = useParams<{tagKey: string}>();

  const [search, setSearch] = useState('');

  return (
    <Fragment>
      <EventNavigator>
        <Header>
          {tagKey
            ? tct('Tag Details - [tagKey]', {tagKey})
            : includeFeatureFlagsTab
              ? t('Tags & Feature Flags')
              : t('All Tags')}
        </Header>

        {tagKey ? (
          <TagExportDropdown
            organization={organization}
            project={project}
            group={group}
            tagKey={tagKey}
          />
        ) : (
          <Grid flow="column" align="center" gap="md" marginLeft="auto">
            {includeFeatureFlagsTab ? (
              <TagFlagPicker setTab={setTab} tab={DrawerTab.TAGS} />
            ) : null}
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
              <Tooltip title="Highlighted tags are shown first">
                <Button aria-label="" disabled size="xs" icon={<IconSort />} />
              </Tooltip>
            ) : null}
          </Grid>
        )}
      </EventNavigator>
      <EventDrawerBody>
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
