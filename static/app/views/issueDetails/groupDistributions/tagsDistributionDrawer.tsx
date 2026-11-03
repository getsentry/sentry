import {Fragment, useState} from 'react';
import {IconSort} from '@sentry/icons/sort';

import {Button} from '@sentry/scraps/button';
import {Tooltip} from '@sentry/scraps/tooltip';

import {EventDrawerBody, EventNavigator} from 'sentry/components/events/eventDrawer';
import {t} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useParams} from 'sentry/utils/useParams';
import {TagDetailsDrawerContent} from 'sentry/views/issueDetails/groupTags/tagDetailsDrawerContent';
import {TagDrawerContent} from 'sentry/views/issueDetails/groupTags/tagDrawerContent';
import {useEnvironmentsFromUrl} from 'sentry/views/issueDetails/utils';

import {GroupDistributionsSearchInput} from './groupDistributionsSearchInput';
import {TagFlagPicker} from './tagFlagPicker';
import {DrawerTab} from './types';

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
      {tagKey ? null : (
        <EventNavigator
          leadingItems={
            <GroupDistributionsSearchInput
              includeFeatureFlagsTab={includeFeatureFlagsTab}
              placeholder={t('Filter tags')}
              search={search}
              onChange={value => {
                setSearch(value);
                trackAnalytics('tags.drawer.action', {
                  control: 'search',
                  organization,
                });
              }}
            />
          }
          trailingItems={
            includeFeatureFlagsTab ? (
              <Fragment>
                <TagFlagPicker setTab={setTab} tab={DrawerTab.TAGS} />
                <Tooltip title={t('Highlighted tags are shown first')}>
                  <Button
                    aria-label={t('Sort Tags')}
                    disabled
                    size="sm"
                    variant="transparent"
                    icon={<IconSort />}
                  />
                </Tooltip>
              </Fragment>
            ) : null
          }
        />
      )}
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
