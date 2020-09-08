import PropTypes from 'prop-types';
import React from 'react';
import styled from '@emotion/styled';
import {css} from '@emotion/core';

import {t} from 'app/locale';
import {callIfFunction} from 'app/utils/callIfFunction';
import {DataSection} from 'app/components/events/styles';
import {IconAnchor} from 'app/icons/iconAnchor';
import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import space from 'app/styles/space';

const defaultProps = {
  wrapTitle: true,
  raw: false,
  isCentered: false,
  showPermalink: true,
};

type DefaultProps = Readonly<typeof defaultProps>;

type Props = {
  className?: string;
  title: React.ReactNode;
  type: string;
  toggleRaw?: (enable: boolean) => void;
  actions?: React.ReactNode;
} & DefaultProps;

class EventDataSection extends React.Component<Props> {
  static propTypes = {
    title: PropTypes.any,
    type: PropTypes.string.isRequired,
    wrapTitle: PropTypes.bool,
    toggleRaw: PropTypes.func,
    raw: PropTypes.bool,
    actions: PropTypes.node,
  };

  static defaultProps = defaultProps;

  componentDidMount() {
    if (location.hash) {
      const [, hash] = location.hash.split('#');

      try {
        const anchorElement = hash && document.querySelector('div#' + hash);
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

  render() {
    const {
      children,
      className,
      type,
      title,
      toggleRaw,
      raw,
      wrapTitle,
      actions,
      isCentered,
      showPermalink,
    } = this.props;

    const titleNode = wrapTitle ? <h3>{title}</h3> : title;

    return (
      <DataSection className={className || ''}>
        {title && (
          <SectionHeader id={type} isCentered={isCentered}>
            {showPermalink ? (
              <Permalink href={'#' + type} className="permalink">
                <StyledIconAnchor />
                {titleNode}
              </Permalink>
            ) : (
              <div>{titleNode}</div>
            )}
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
}

const StyledIconAnchor = styled(IconAnchor)`
  display: none;
  position: absolute;
  top: 4px;
  left: -22px;
`;

const Permalink = styled('a')`
  :hover ${StyledIconAnchor} {
    display: block;
    color: ${p => p.theme.gray500};
  }
`;

const SectionHeader = styled('div')<{isCentered?: boolean}>`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  margin-bottom: ${space(2)};

  > * {
    margin-bottom: ${space(1)};
  }

  & h3,
  & h3 a {
    font-size: 14px;
    font-weight: 600;
    line-height: 1.2;
    color: ${p => p.theme.gray500};
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
    color: ${p => p.theme.gray700};
    font-size: ${p => p.theme.fontSizeMedium};
    margin-right: ${space(0.5)};
    margin-left: ${space(0.5)};

    text-transform: none;
  }
  & small > span {
    color: ${p => p.theme.gray700};
    border-bottom: 1px dotted ${p => p.theme.borderDark};
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

const SectionContents = styled('div')`
  position: relative;
`;

const ActionContainer = styled('div')`
  flex-shrink: 0;
  max-width: 100%;
`;

export default EventDataSection;
