import type {Location} from 'history';

import {Button, LinkButton} from '@sentry/scraps/button';
import {Grid} from '@sentry/scraps/layout';

import {Collapsible} from 'sentry/components/collapsible';
import {IdBadge} from 'sentry/components/idBadge';
import {extractSelectionParameters} from 'sentry/components/pageFilters/parse';
import * as SidebarSection from 'sentry/components/sidebarSection';
import {t, tn} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {ReleaseProject} from 'sentry/types/release';
import {makeReleasesPathname} from 'sentry/views/explore/releases/utils/pathnames';

type Props = {
  location: Location;
  organization: Organization;
  projects: ReleaseProject[];
  version: string;
};

export function OtherProjects({projects, location, version, organization}: Props) {
  return (
    <SidebarSection.Wrap>
      <SidebarSection.Title>
        {tn(
          'Other Project for This Release',
          'Other Projects for This Release',
          projects.length
        )}
      </SidebarSection.Title>
      <SidebarSection.Content>
        <Collapsible
          expandButton={({onExpand, numberOfHiddenItems}) => (
            <Button variant="link" onClick={onExpand}>
              {tn(
                'Show %s collapsed project',
                'Show %s collapsed projects',
                numberOfHiddenItems
              )}
            </Button>
          )}
        >
          {projects.map(project => (
            <Grid
              key={project.id}
              align="center"
              columns="1fr max-content"
              css={theme => ({
                fontSize: theme.font.size.md,
                [`@container (min-width: ${theme.container['3xl']}) and (max-width: ${theme.container['4xl']})`]:
                  {
                    gridTemplateColumns: '200px max-content',
                  },
              })}
              justify="between"
              marginBottom="sm"
            >
              <IdBadge project={project} avatarSize={16} />
              <LinkButton
                size="xs"
                to={{
                  pathname: makeReleasesPathname({
                    organization,
                    path: `/${encodeURIComponent(version)}/`,
                  }),
                  query: {
                    ...extractSelectionParameters(location.query),
                    project: project.id,
                    yAxis: undefined,
                  },
                }}
              >
                {t('View')}
              </LinkButton>
            </Grid>
          ))}
        </Collapsible>
      </SidebarSection.Content>
    </SidebarSection.Wrap>
  );
}
