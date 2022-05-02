import {css} from '@emotion/react';
import styled from '@emotion/styled';

import Button from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {DataSection} from 'sentry/components/events/styles';
import Link from 'sentry/components/links/link';
import {IconAnchor} from 'sentry/icons/iconAnchor';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {callIfFunction} from 'sentry/utils/callIfFunction';

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
                <PermalinkAnchor href={`#${type}`} />
                <StyledIconAnchor size="xs" color="subText" />
                {titleNode}
              </Permalink>
            ) : (
              titleNode
            )}
          </Title>
          {type === 'extra' && (
            <ButtonBar merged active={raw ? 'raw' : 'formatted'}>
              <Button
                barId="formatted"
                size="xsmall"
                onClick={() => callIfFunction(toggleRaw, false)}
              >
                {t('Formatted')}
              </Button>
              <Button
                barId="raw"
                size="xsmall"
                onClick={() => callIfFunction(toggleRaw, true)}
              >
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

const StyledIconAnchor = styled(IconAnchor)`
  position: absolute;
  top: 8px;
  left: -16px;
  opacity: 0;
  transition: opacity 100ms;
`;

const Permalink = styled('span')`
  width: 100%;
  position: relative;

  /* Improved hitbox for the anchor icon */
  &:after {
    content: '';
    position: absolute;
    width: 20px;
    height: 16px;
    top: 6px;
    left: -20px;
  }

  :hover ${StyledIconAnchor} {
    opacity: 1;
  }
`;

const PermalinkAnchor = styled(Link)`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
`;

const SectionHeader = styled('div')<{isCentered?: boolean}>`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  margin-bottom: ${space(1)};

  > * {
    margin-bottom: ${space(0.5)};
  }

  & h3,
  & h3 a {
    font-size: 14px;
    font-weight: 600;
    line-height: 1.2;
    color: ${p => p.theme.gray300};
  }

  & h3 {
    font-size: 14px;
    font-weight: 600;
    line-height: 1.2;
    padding: ${space(0.75)} 0;
    margin-bottom: 0;
    text-transform: uppercase;
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

  @media (min-width: ${props => props.theme.breakpoints[2]}) {
    & > small {
      margin-left: ${space(1)};
      display: inline-block;
    }
  }

  ${p =>
    p.isCentered &&
    css`
      align-items: center;
      @media (max-width: ${p.theme.breakpoints[0]}) {
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
