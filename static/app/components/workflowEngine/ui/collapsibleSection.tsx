import styled from '@emotion/styled';

import {Flex} from 'sentry/components/container/flex';
import InteractionStateLayer from 'sentry/components/interactionStateLayer';
import {IconChevron} from 'sentry/icons';
import {space} from 'sentry/styles/space';

export default function CollapsibleSection({
  children,
  title,
  description,
  open = false,
}: {
  children: React.ReactNode;
  title: string;
  description?: string;
  open?: boolean;
}) {
  return (
    <Body open={open}>
      <HeadingWrapper>
        <InteractionStateLayer />
        <Heading>{title}</Heading>
        <IconChevron className="arrow" />
      </HeadingWrapper>

      <Flex column gap={space(0.5)}>
        {description && <Description>{description}</Description>}
        {children}
      </Flex>
    </Body>
  );
}

const Body = styled('details')`
  display: flex;
  flex-direction: column;
  background-color: ${p => p.theme.backgroundElevated};
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  padding: ${space(2)} ${space(2)};

  &[open] {
    gap: ${space(2)};
    summary {
      padding-bottom: ${space(0.75)};
    }
    .arrow {
      transform: rotate(0deg);
    }
  }
  summary {
    padding-bottom: ${space(2)};
  }
  .arrow {
    transform: rotate(180deg);
  }
`;

const Heading = styled('h2')`
  font-size: ${p => p.theme.fontSizeExtraLarge};
  margin: 0;
`;

const HeadingWrapper = styled('summary')`
  display: flex;
  justify-content: space-between;
  position: relative;
  align-items: center;
  padding: ${space(2)} ${space(2)};
  margin: -${space(2)} -${space(2)};
  border-radius: ${p => p.theme.borderRadius};
  cursor: pointer;
`;

const Description = styled('span')`
  font-size: ${p => p.theme.fontSizeMedium};
  color: ${p => p.theme.subText};
  margin: 0;
  padding: 0;
`;
