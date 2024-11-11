import styled from '@emotion/styled';

import {DataSection} from 'sentry/components/events/styles';
import Anchor from 'sentry/components/links/anchor';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {IconLink} from 'sentry/icons';
import {space} from 'sentry/styles/space';

export interface EventDataSectionProps {
  children: React.ReactNode;
  /**
   * The title of the section
   */
  title: React.ReactNode;
  /**
   * Used as the `id` of the section. This powers the permalink
   */
  type: string;
  /**
   * Actions that appear to the far right of the title
   */
  actions?: React.ReactNode;
  className?: string;
  /**
   * A description shown in a QuestionTooltip
   */
  help?: React.ReactNode;
  /**
   * If true, user is able to hover overlay without it disappearing. (nice if
   * you want the overlay to be interactive)
   */
  isHelpHoverable?: boolean;
  /**
   * Should the permalink be enabled for this section?
   *
   * @default true
   */
  showPermalink?: boolean;
  /**
   * Should the title be wrapped in a h3?
   */
  wrapTitle?: boolean;
}

function scrollToSection(element: HTMLDivElement) {
  if (window.location.hash && element) {
    const [, hash] = window.location.hash.split('#');

    try {
      const anchorElement = hash && element.querySelector('div#' + hash);
      if (anchorElement) {
        anchorElement.scrollIntoView();
      }
    } catch {
      // Since we're blindly taking the hash from the url and shoving
      // it into a querySelector, it's possible that this may
      // raise an exception if the input is invalid. So let's just ignore
      // this instead of blowing up.
      // e.g. `document.querySelector('div#=')`
      // > Uncaught DOMException: Failed to execute 'querySelector' on 'Document': 'div#=' is not a valid selector.
    }
  }
}

export function EventDataSection({
  children,
  className,
  type,
  title,
  help,
  actions,
  wrapTitle = true,
  showPermalink = true,
  isHelpHoverable = false,
  ...props
}: EventDataSectionProps) {
  const titleNode = wrapTitle ? <h3>{title}</h3> : title;

  return (
    <DataSection ref={scrollToSection} className={className || ''} {...props}>
      <SectionHeader id={type} data-test-id={`event-section-${type}`}>
        {title && (
          <Title>
            {showPermalink ? (
              <Permalink className="permalink">
                <PermalinkAnchor href={`#${type}`}>
                  <StyledIconLink size="xs" color="subText" />
                </PermalinkAnchor>
                {titleNode}
              </Permalink>
            ) : (
              titleNode
            )}
            {help && (
              <QuestionTooltip size="xs" title={help} isHoverable={isHelpHoverable} />
            )}
          </Title>
        )}
        {actions && <ActionContainer>{actions}</ActionContainer>}
      </SectionHeader>
      <SectionContents>{children}</SectionContents>
    </DataSection>
  );
}

const Title = styled('div')`
  display: grid;
  grid-template-columns: max-content 1fr;
  align-items: center;
  gap: ${space(0.5)};
`;

const Permalink = styled('span')`
  width: 100%;
  position: relative;
`;

const StyledIconLink = styled(IconLink)`
  opacity: 0;
  transform: translateY(-1px);
  transition: opacity 100ms;
`;

const PermalinkAnchor = styled(Anchor)`
  display: flex;
  align-items: center;
  position: absolute;
  top: 0;
  left: 0;
  width: calc(100% + ${space(3)});
  height: 100%;
  padding-left: ${space(0.5)};
  transform: translateX(-${space(3)});

  :hover ${StyledIconLink}, :focus ${StyledIconLink} {
    opacity: 1;
  }
`;

const SectionHeader = styled('div')`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${space(0.5)};
  margin-bottom: ${space(1)};

  & h3,
  & h3 a {
    color: ${p => p.theme.subText};
    font-size: ${p => p.theme.fontSizeMedium};
    font-weight: ${p => p.theme.fontWeightBold};
  }

  & h3 {
    padding: ${space(0.75)} 0;
    margin-bottom: 0;
  }

  & small {
    color: ${p => p.theme.textColor};
    font-size: ${p => p.theme.fontSizeMedium};
    margin-right: ${space(0.5)};
    margin-left: ${space(0.5)};
  }
  & small > span {
    color: ${p => p.theme.textColor};
    font-weight: ${p => p.theme.fontWeightNormal};
  }

  @media (min-width: ${p => p.theme.breakpoints.large}) {
    & > small {
      margin-left: ${space(1)};
      display: inline-block;
    }
  }

  > *:first-child {
    position: relative;
    flex-grow: 1;
  }
`;

export const SectionContents = styled('div')`
  position: relative;
`;

const ActionContainer = styled('div')`
  flex-shrink: 0;
  max-width: 100%;
`;
