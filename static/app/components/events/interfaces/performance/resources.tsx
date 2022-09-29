import styled from '@emotion/styled';

import {IconDocs} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';

import EventDataSection from '../../eventDataSection';

export type ResourceLink = {
  link: string;
  text: string;
};

type Props = {
  description: string;
  links: ResourceLink[];
};

// This section provides users with resources on how to resolve an issue
export function Resources(props: Props) {
  return (
    <EventDataSection type="resources-and-whatever" title={t('Resources and Whatever')}>
      {props.description}
      {props.links.length === 0 ? (
        <NoResourcesMessage>
          {t(
            "Well this is awkward. We don't appear to have any resources available for your project platform :("
          )}
        </NoResourcesMessage>
      ) : (
        <LinkSection>
          {props.links.map(({link, text}) => (
            <a key={link} href={link} target="_blank" rel="noreferrer">
              <IconDocs /> {text}
            </a>
          ))}
        </LinkSection>
      )}
    </EventDataSection>
  );
}

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

const NoResourcesMessage = styled('p')`
  margin-top: ${space(1)};
`;
