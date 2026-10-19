import {useState} from 'react';

import {Menu} from '@sentry/scraps/menu';

export function SubmenuDemo() {
  const [project, setProject] = useState('');

  return (
    <Menu.Root>
      <Menu.Trigger>{project ? `Project: ${project}` : 'Choose project'}</Menu.Trigger>
      <Menu.Content>
        <Menu.List aria-label="Actions">
          <Menu.Submenu label="Choose project">
            <Menu.Content>
              <Menu.Header title="Projects">
                <Menu.Search aria-label="Search projects" placeholder="Search projects" />
              </Menu.Header>
              <Menu.List aria-label="Projects">
                <Menu.Section>
                  <Menu.SectionLabel>Favorites</Menu.SectionLabel>
                  <Menu.ListItem label="Alpha" onAction={() => setProject('Alpha')} />
                  <Menu.ListItem label="Beta" onAction={() => setProject('Beta')} />
                </Menu.Section>
                <Menu.SectionSeparator />
                <Menu.Section>
                  <Menu.SectionLabel>Other projects</Menu.SectionLabel>
                  <Menu.ListItem label="Gamma" onAction={() => setProject('Gamma')} />
                </Menu.Section>
              </Menu.List>
            </Menu.Content>
          </Menu.Submenu>
        </Menu.List>
      </Menu.Content>
    </Menu.Root>
  );
}
