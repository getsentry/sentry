import styled from '@emotion/styled';

import {LinkButton} from '@sentry/scraps/button';

import type {Group} from 'sentry/types/group';
import {trackAnalytics} from 'sentry/utils/analytics';
import type {IssueTypeConfig, ResourceLink} from 'sentry/utils/issueTypeConfig/types';
import {useOrganization} from 'sentry/utils/useOrganization';

type Props = {
  configResources: NonNullable<IssueTypeConfig['resources']>;
  group: Group;
  platform: Group['platform'];
};

export function Resources({configResources, platform, group}: Props) {
  const organization = useOrganization();
  const links: ResourceLink[] = [
    ...configResources.links,
    ...(configResources.linksByPlatform[platform] ?? []),
  ];

  return (
    <div>
      <p>{configResources.description}</p>
      <LinkSection>
        {links.map(({link, text}) => (
          <LinkButton
            onClick={() =>
              trackAnalytics('issue_details.resources_link_clicked', {
                organization,
                resource: text,
                group_id: group.id,
              })
            }
            key={link}
            href={link}
            external
            variant="link"
          >
            {text}
          </LinkButton>
        ))}
      </LinkSection>
    </div>
  );
}

const LinkSection = styled('div')`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  text-decoration: underline;
  text-decoration-color: ${p => p.theme.tokens.interactive.link.accent.rest};
  gap: ${p => p.theme.space.md};
  margin-top: ${p => p.theme.space.md};
`;
