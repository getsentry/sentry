import {useTheme} from '@emotion/react';

import {Badge} from 'sentry/components/core/badge';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {IconGithub} from 'sentry/icons';
import {
  isMDXStory,
  type StoryResources as Resources,
} from 'sentry/stories/view/useStoriesLoader';
import {useStory} from 'sentry/stories/view/useStory';

export function StoryResources() {
  const {story} = useStory();
  const theme = useTheme();

  if (!isMDXStory(story)) {
    return null;
  }

  const resources: Resources = story.exports.frontmatter?.resources ?? {};

  return (
    <table style={{marginTop: theme.space['3xl']}}>
      <thead>
        <tr>
          <th>Type</th>
          <th>Resource</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        {Object.entries(resources).map(([type, data]) => {
          switch (type) {
            case 'figma':
              return <FigmaResource key={type} href={data} />;
            case 'js':
              return <JsResource key={type} href={data} />;
            case 'a11y':
              return <A11yResource key={type} items={data} />;
            default:
              return null;
          }
        })}
      </tbody>
    </table>
  );
}

function IconFigma() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24">
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M12.75 15.373a3.999 3.999 0 0 0 6.195-4.654A4 4 0 0 0 17.583 9a4 4 0 0 0 1.668-3.25a4 4 0 0 0-4-4h-6.5A4 4 0 0 0 6.418 9a4 4 0 0 0 0 6.5a4 4 0 1 0 6.332 3.25zm-4-12.123a2.5 2.5 0 1 0 0 5h2.5v-5zm2.5 13h-2.5a2.5 2.5 0 1 0 2.5 2.5zm-2.5-6.5a2.5 2.5 0 0 0 0 5h2.5v-5zm4 2.5a2.5 2.5 0 1 0 5.001 0a2.5 2.5 0 0 0-5.001 0m2.5-4a2.5 2.5 0 1 0 0-5h-2.5v5z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function FigmaResource(props: {href: string}) {
  return (
    <tr>
      <td>Design</td>
      <td>
        <LinkButton href={props.href} icon={<IconFigma />} size="sm" external>
          Open in Figma
        </LinkButton>
      </td>
      <td>
        <Badge variant="new">Available</Badge>
      </td>
    </tr>
  );
}

function JsResource(props: {href: string}) {
  return (
    <tr>
      <td>Implementation</td>
      <td>
        <LinkButton href={props.href} icon={<IconGithub />} size="sm" external>
          Open in GitHub
        </LinkButton>
      </td>
      <td>
        <Badge variant="beta">In Progress</Badge>
      </td>
    </tr>
  );
}

function A11yResource(props: {items: Record<string, string>}) {
  const theme = useTheme();
  return (
    <tr>
      <td>Accessibility</td>
      <td>
        <ul style={{listStyle: 'none', padding: 0}}>
          {Object.entries(props.items).map(([text, href]) => (
            <li style={{padding: `${theme.space.xs} 0`}} key={href}>
              <a target="_blank" href={href} rel="noreferrer">
                {text}
              </a>
            </li>
          ))}
        </ul>
      </td>
      <td>
        <Badge variant="internal">Reference</Badge>
      </td>
    </tr>
  );
}
