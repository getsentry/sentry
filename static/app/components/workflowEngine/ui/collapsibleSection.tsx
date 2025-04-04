import {useState} from 'react';
import styled from '@emotion/styled';

import {Flex} from 'sentry/components/container/flex';
import InteractionStateLayer from 'sentry/components/interactionStateLayer';
import {IconChevron} from 'sentry/icons';
import {space} from 'sentry/styles/space';

export default function CollapsibleSection({
  children,
  title,
  description,
  collapsible = true,
  initialCollapse = false,
}: {
  children: React.ReactNode;
  title: string;
  collapsible?: boolean;
  description?: string;
  initialCollapse?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(initialCollapse);
  const toggleOpen = () => {
    setIsOpen(!isOpen);
  };

  return (
    <Body column>
      <HeadingWrapper
        onClick={toggleOpen}
        justify="space-between"
        collapsible={collapsible}
      >
        <InteractionStateLayer hidden={!collapsible} />
        <Heading>{title}</Heading>
        {collapsible && <IconChevron direction={isOpen ? 'down' : 'up'} />}
      </HeadingWrapper>

      {!collapsible || isOpen ? (
        <Flex column gap={space(0.5)}>
          {description && <Description>{description}</Description>}
          {children}
        </Flex>
      ) : null}
    </Body>
  );
}

export const Body = styled(Flex)`
  background-color: ${p => p.theme.white};
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  padding: ${space(1.5)} ${space(2)};
`;

export const Heading = styled('h2')`
  font-size: ${p => p.theme.fontSizeExtraLarge};
  margin: 0;
`;

export const HeadingWrapper = styled(Flex)<{collapsible: boolean}>`
  position: relative;
  align-items: center;
  cursor: ${p => (p.collapsible ? 'pointer' : 'initial')};
  padding: ${space(0.75)} ${space(1.5)};
  margin: 0 -${space(1.5)};
  border-radius: ${p => p.theme.borderRadius};
`;

export const Description = styled('span')`
  font-size: ${p => p.theme.fontSizeMedium};
  color: ${p => p.theme.subText};
  margin: 0;
  padding: 0;
`;
