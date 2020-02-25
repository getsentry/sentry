import PropTypes from 'prop-types';
import React from 'react';
import styled from '@emotion/styled';

import {t} from 'app/locale';
import {callIfFunction} from 'app/utils/callIfFunction';
import {DataSection} from 'app/components/events/styles';
import space from 'app/styles/space';

const defaultProps = {
  wrapTitle: true,
  raw: false,
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
      } catch (e) {
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
    } = this.props;

    const titleNode = wrapTitle ? <h3>{title}</h3> : title;

    return (
      <DataSection className={className || ''}>
        {title && (
          <SectionHeader id={type}>
            <Permalink href={'#' + type} className="permalink">
              <em className="icon-anchor" />
            </Permalink>
            {titleNode}
            {type === 'extra' && (
              <div className="btn-group">
                <a
                  className={(!raw ? 'active' : '') + ' btn btn-default btn-sm'}
                  onClick={() => callIfFunction(toggleRaw, false)}
                >
                  {t('Formatted')}
                </a>
                <a
                  className={(raw ? 'active' : '') + ' btn btn-default btn-sm'}
                  onClick={() => callIfFunction(toggleRaw, true)}
                >
                  {t('Raw')}
                </a>
              </div>
            )}
            {actions && <ActionContainer>{actions}</ActionContainer>}
          </SectionHeader>
        )}
        <SectionContents>{children}</SectionContents>
      </DataSection>
    );
  }
}

const Permalink = styled('a')`
  font-size: ${p => p.theme.fontSizeSmall};
  line-height: 27px;
  display: none;
  position: absolute;
  top: -1.5px;
  left: -22px;
  color: ${p => p.theme.gray6};
  padding: ${space(0.25)} 5px;
`;

const SectionHeader = styled('div')`
  display: flex;
  justify-content: space-between;
  position: relative;

  & h3,
  & h3 a {
    font-size: 14px;
    font-weight: 600;
    line-height: 1.2;
    color: ${p => p.theme.gray2};
  }

  & h3 {
    font-size: 14px;
    font-weight: 600;
    line-height: 1.2;
    padding: ${space(0.75)} 0;
    text-transform: uppercase;
    margin-bottom: 20px;
  }

  & small {
    color: ${p => p.theme.foreground};
    font-size: ${p => p.theme.fontSizeMedium};
    margin-right: ${space(0.5)};
    margin-left: ${space(0.5)};

    text-transform: none;
  }
  & small a {
    color: ${p => p.theme.foreground};
    border-bottom: 1px dotted ${p => p.theme.gray6};
    font-weight: normal;
  }

  &:hover ${Permalink} {
    display: block;
  }
  @media (min-width: ${props => props.theme.breakpoints[2]}) {
    & > small {
      margin-left: ${space(1)};
      display: inline-block;
    }
  }
`;

const SectionContents = styled('div')`
  position: relative;
`;

const ActionContainer = styled('div')`
  flex-shrink: 0;
`;

export default EventDataSection;
