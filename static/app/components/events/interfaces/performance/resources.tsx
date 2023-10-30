import styled from '@emotion/styled';

import ExternalLink from 'sentry/components/links/externalLink';
import {IconDocs} from 'sentry/icons';
import {space} from 'sentry/styles/space';
import {Event} from 'sentry/types';
import {IssueTypeConfig} from 'sentry/utils/issueTypeConfig/types';

export type ResourceLink = {
  link: string;
  text: string;
};

type Props = {
  configResources: NonNullable<IssueTypeConfig['resources']>;
  eventPlatform: Event['platform'];
};

// This section provides users with resources on how to resolve an issue
export function Resources({configResources, eventPlatform}: Props) {
  const links = [
    ...configResources.links,
    ...(configResources.linksByPlatform[eventPlatform ?? ''] ?? []),
  ];

  return (
    <div>
      {configResources.description}
      <LinkSection>
        {links.map(({link, text}) => (
          // Please note that the UI will not fit a very long text and if we need to support that we will need to update the UI
          <ExternalLink key={link} href={link} openInNewTab>
            <IconDocs /> {text}
          </ExternalLink>
        ))}
      </LinkSection>
    </div>
  );
}

const LinkSection = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(1)};

  margin-top: ${space(2)};

  a {
    display: flex;
    align-items: center;
  }

  svg {
    margin-right: ${space(1)};
  }
`;
