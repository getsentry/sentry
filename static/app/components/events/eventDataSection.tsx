import * as React from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import {DataSection} from 'app/components/events/styles';
import {IconAnchor} from 'app/icons/iconAnchor';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {callIfFunction} from 'app/utils/callIfFunction';

const defaultProps = {
  wrapTitle: true,
  raw: false,
  isCentered: false,
  showPermalink: true,
};

type DefaultProps = Readonly<typeof defaultProps>;

type Props = {
  title: React.ReactNode;
  type: string;
  toggleRaw?: (enable: boolean) => void;
  actions?: React.ReactNode;
  className?: string;
} & DefaultProps;

class EventDataSection extends React.Component<Props> {
  static defaultProps = defaultProps;

  componentDidMount() {
    const dataSectionDOM = this.dataSectionDOMRef.current;
    if (location.hash && dataSectionDOM) {
      const [, hash] = location.hash.split('#');

      try {
        const anchorElement = hash && dataSectionDOM.querySelector('div#' + hash);
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

  dataSectionDOMRef = React.createRef<HTMLDivElement>();

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
      ...props
    } = this.props;

    const titleNode = wrapTitle ? <h3>{title}</h3> : title;

    return (
      <DataSection ref={this.dataSectionDOMRef} className={className || ''} {...props}>
        {title && (
          <SectionHeader id={type} isCentered={isCentered}>
            <Title>
              {showPermalink ? (
                <Permalink href={'#' + type} className="permalink">
                  <StyledIconAnchor />
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
}

const Title = styled('div')`
  display: flex;
`;

const StyledIconAnchor = styled(IconAnchor)`
  display: none;
  position: absolute;
  top: 4px;
  left: -22px;
`;

const Permalink = styled('a')`
  width: 100%;
  :hover ${StyledIconAnchor} {
    display: block;
    color: ${p => p.theme.gray300};
  }
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
    border-bottom: 1px dotted ${p => p.theme.border};
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
