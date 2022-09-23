import {css} from '@emotion/react';
import styled from '@emotion/styled';

import Button from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {DataSection} from 'sentry/components/events/styles';
import Anchor from 'sentry/components/links/anchor';
import {IconLink} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';

type Props = {
  children: React.ReactNode;
  title: React.ReactNode;
  type: string;
  actions?: React.ReactNode;
  className?: string;
  isCentered?: boolean;
  raw?: boolean;
  showPermalink?: boolean;
  toggleRaw?: (enable: boolean) => void;
  wrapTitle?: boolean;
};

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

function EventDataSection({
  children,
  className,
  type,
  title,
  toggleRaw,
  raw = false,
  wrapTitle = true,
  actions,
  isCentered = false,
  showPermalink = true,
  ...props
}: Props) {
  const titleNode = wrapTitle ? <h3>{title}</h3> : title;

  return (
    <DataSection ref={scrollToSection} className={className || ''} {...props}>
      {title && (
        <SectionHeader id={type} isCentered={isCentered}>
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
          </Title>
          {type === 'extra' && (
            <ButtonBar merged active={raw ? 'raw' : 'formatted'}>
              <Button barId="formatted" size="xs" onClick={() => toggleRaw?.(false)}>
                {t('Formatted')}
              </Button>
              <Button barId="raw" size="xs" onClick={() => toggleRaw?.(true)}>
                {t('Raw')}
              </Button>
            </ButtonBar>
          )}
          {actions && <ActionContainer>{actions}</ActionContainer>}
        </SectionHeader>
      )}
      <SectionContents>{children}</SectionContents>
    </DataSection>
  );
}

const Title = styled('div')`
  display: flex;
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

const SectionHeader = styled('div')<{isCentered?: boolean}>`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  margin-bottom: ${space(1)};

  & h3,
  & h3 a {
    color: ${p => p.theme.subText};
    font-size: ${p => p.theme.fontSizeMedium};
    font-weight: 600;
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

    text-transform: none;
  }
  & small > span {
    color: ${p => p.theme.textColor};
    font-weight: normal;
  }

  @media (min-width: ${props => props.theme.breakpoints.large}) {
    & > small {
      margin-left: ${space(1)};
      display: inline-block;
    }
  }

  ${p =>
    p.isCentered &&
    css`
      align-items: center;
      @media (max-width: ${p.theme.breakpoints.small}) {
        display: block;
      }
    `}

  >*:first-child {
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

export default EventDataSection;
