import styled from '@emotion/styled';

import {LinkButton} from 'sentry/components/button';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import {trackAnalytics} from 'sentry/utils/analytics';
import type {IssueTypeConfig, ResourceLink} from 'sentry/utils/issueTypeConfig/types';
import useOrganization from 'sentry/utils/useOrganization';

type Props = {
  configResources: NonNullable<IssueTypeConfig['resources']>;
  eventPlatform: Event['platform'];
  group: Group;
};

export default function Resources({configResources, eventPlatform, group}: Props) {
  const organization = useOrganization();
  const links: ResourceLink[] = [
    ...configResources.links,
    ...(configResources.linksByPlatform[
      (eventPlatform ?? '') as keyof typeof configResources.linksByPlatform
    ] ?? []),
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
            priority="link"
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
  text-decoration-color: ${p => p.theme.linkUnderline};
  gap: ${space(1)};
  margin-top: ${space(1)};
`;
