import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {ProjectAvatar} from '@sentry/scraps/avatar';
import {DropdownMenu} from '@sentry/scraps/dropdownMenu';
import {Container} from '@sentry/scraps/layout';

import {BookmarkStarIcon} from 'sentry/components/projects/bookmarkStar';

import {NavigationMenuHeader} from './navigationMenuHeader';
import {ORGANIZATION_MENU_MAX_WIDTH} from './organizationDropdown';

const LONG_SLUG = 'a-very-long-slug-that-keeps-going-past-the-menu-edge';

function projectItem(slug: string, id: string) {
  return {
    key: `project-${id}`,
    label: slug,
    leadingItems: <ProjectAvatar project={ProjectFixture({id, slug})} size={16} />,
    trailingAction: {
      icon: <BookmarkStarIcon isBookmarked={false} />,
      label: 'Bookmark',
      onAction: () => {},
    },
  };
}

describe('OrganizationDropdown', () => {
  // OrganizationDropdown renders its menu into a portal, which server rendering
  // can't produce, so this renders a DropdownMenu with the same width open in place.
  it.snapshot(
    'open-menu-long-slugs',
    () => (
      <QueryClientProvider
        client={new QueryClient({defaultOptions: {queries: {gcTime: Infinity}}})}
      >
        <Container width="600px" height="360px" padding="md">
          <DropdownMenu
            isOpen
            triggerLabel="Organization"
            maxWidth={ORGANIZATION_MENU_MAX_WIDTH}
            menuTitle={
              <NavigationMenuHeader
                organization={OrganizationFixture({name: LONG_SLUG, slug: LONG_SLUG})}
                projectCount={2}
              />
            }
            items={[
              {
                key: 'organization',
                children: [{key: 'settings', label: 'Settings'}],
              },
              {
                key: 'project-settings',
                label: 'Project Settings',
                children: [projectItem(LONG_SLUG, '1'), projectItem('short', '2')],
              },
            ]}
          />
        </Container>
      </QueryClientProvider>
    ),
    {tags: {area: 'core', slug: 'long'}}
  );
});
