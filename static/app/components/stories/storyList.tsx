import Link from 'sentry/components/links/link';

interface Props {
  links: string[];
}

export default function StoryList({links}: Props) {
  return (
    <ul>
      {links.map(name => (
        <li key={name}>
          <Link
            to={{
              pathname: '/stories',
              query: {name},
            }}
          >
            {name}
          </Link>
        </li>
      ))}
    </ul>
  );
}
