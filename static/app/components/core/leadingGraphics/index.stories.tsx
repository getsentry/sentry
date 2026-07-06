import {Fragment} from 'react';

import {Flex} from '@sentry/scraps/layout';
import {LeadingGraphics} from '@sentry/scraps/leadingGraphics';
import {Text} from '@sentry/scraps/text';

import {IconSettings, IconStar, IconUser} from 'sentry/icons';
import * as Storybook from 'sentry/stories';

export const documentation =
  import('!!type-loader!sentry/components/core/leadingGraphics');

export default Storybook.story('LeadingGraphics', story => {
  story('Variants', () => (
    <Fragment>
      <p>
        <Storybook.JSXNode name="LeadingGraphics" /> is a 16×16 leading graphic used by
        breadcrumb items and navigation links. It supports three{' '}
        <Storybook.JSXProperty name="variant" value="string" /> values:{' '}
        <code>'icon'</code>, <code>'avatar'</code>, and <code>'badge-project'</code>.
      </p>
      <Storybook.SideBySide>
        <Flex align="center" gap="sm">
          <LeadingGraphics variant="icon" icon={<IconSettings size="xs" />} />
          <Text variant="muted">icon</Text>
        </Flex>
        <Flex align="center" gap="sm">
          <LeadingGraphics variant="icon" icon={<IconStar size="xs" />} />
          <Text variant="muted">icon (star)</Text>
        </Flex>
        <Flex align="center" gap="sm">
          <LeadingGraphics variant="avatar" avatar={<IconUser size="xs" />} />
          <Text variant="muted">avatar</Text>
        </Flex>
      </Storybook.SideBySide>
    </Fragment>
  ));

  story('Badge-project: platform counts', () => (
    <Fragment>
      <p>
        The <code>'badge-project'</code> variant adapts based on the number of entries in{' '}
        <Storybook.JSXProperty name="projectPlatforms" value="string[]" />:
      </p>
      <ul>
        <li>
          <strong>0 platforms</strong> — renders{' '}
          <Storybook.JSXNode name="IconMyProjects" /> or{' '}
          <Storybook.JSXNode name="IconAllProjects" /> (controlled by{' '}
          <Storybook.JSXProperty name="allProjects" value />)
        </li>
        <li>
          <strong>1 platform</strong> — renders a single bordered{' '}
          <Storybook.JSXNode name="PlatformIcon" /> at 14×14
        </li>
        <li>
          <strong>2+ platforms</strong> — renders two stacked 12×12 icons
        </li>
      </ul>
      <Storybook.SideBySide>
        <Flex align="center" gap="sm">
          <LeadingGraphics variant="badge-project" projectPlatforms={[]} />
          <Text variant="muted">0 platforms (my projects)</Text>
        </Flex>
        <Flex align="center" gap="sm">
          <LeadingGraphics variant="badge-project" projectPlatforms={[]} allProjects />
          <Text variant="muted">0 platforms (all projects)</Text>
        </Flex>
        <Flex align="center" gap="sm">
          <LeadingGraphics variant="badge-project" projectPlatforms={['javascript']} />
          <Text variant="muted">1 platform</Text>
        </Flex>
        <Flex align="center" gap="sm">
          <LeadingGraphics
            variant="badge-project"
            projectPlatforms={['python', 'javascript']}
          />
          <Text variant="muted">2 platforms</Text>
        </Flex>
        <Flex align="center" gap="sm">
          <LeadingGraphics
            variant="badge-project"
            projectPlatforms={['react', 'node', 'python']}
          />
          <Text variant="muted">3 platforms (still shows first two)</Text>
        </Flex>
      </Storybook.SideBySide>
    </Fragment>
  ));

  story('Badge-project: platform examples', () => (
    <Fragment>
      <p>
        Platform slugs are passed directly to <Storybook.JSXNode name="PlatformIcon" />{' '}
        from <code>platformicons</code>.
      </p>
      <Storybook.SideBySide>
        {(
          [
            'javascript',
            'python',
            'ruby',
            'php',
            'java',
            'go',
            'rust',
            'react',
            'node',
            'dotnet',
          ] as string[]
        ).map(platform => (
          <Flex key={platform} align="center" gap="sm">
            <LeadingGraphics variant="badge-project" projectPlatforms={[platform]} />
            <Text variant="muted">{platform}</Text>
          </Flex>
        ))}
      </Storybook.SideBySide>
    </Fragment>
  ));
});
