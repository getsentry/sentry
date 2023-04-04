import styled from '@emotion/styled';

import {IconDocs} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Event, Group} from 'sentry/types';
import {getConfigForIssueType} from 'sentry/utils/issueTypeConfig';

import {EventDataSection} from '../../eventDataSection';

export type ResourceLink = {
  link: string;
  text: string;
};

type Props = {
  event: Event;
  group: Group;
};

// This section provides users with resources on how to resolve an issue
export const Resources = ({group, event}: Props) => {
  const config = getConfigForIssueType(group);

  if (!config.resources) {
    return null;
  }

  const links = [
    ...config.resources.links,
    ...(config.resources.linksByPlatform[event.platform ?? ''] ?? []),
  ];

  return (
    <EventDataSection type="resources-and-whatever" title={t('Resources and Whatever')}>
      {config.resources.description}
      <LinkSection>
        {links.map(({link, text}) => (
          <a key={link} href={link} target="_blank" rel="noreferrer">
            <IconDocs /> {text}
          </a>
        ))}
      </LinkSection>
    </EventDataSection>
  );
};

const LinkSection = styled('div')`
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-row-gap: ${space(1)};

  @media (max-width: ${p => p.theme.breakpoints.small}) {
    grid-template-columns: 1fr;
  }

  margin-top: ${space(2)};

  a {
    display: flex;
    align-items: center;
  }

  svg {
    margin-right: ${space(1)};
  }
`;
