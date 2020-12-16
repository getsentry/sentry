import React from 'react';
import {css} from '@emotion/core';
import styled from '@emotion/styled';
import forOwn from 'lodash/forOwn';
import isNil from 'lodash/isNil';
import isObject from 'lodash/isObject';

import Hovercard from 'app/components/hovercard';
import ExternalLink from 'app/components/links/externalLink';
import Pill from 'app/components/pill';
import Pills from 'app/components/pills';
import {IconInfo, IconOpen} from 'app/icons';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {Mechanism} from 'app/types/stacktrace';
import {isUrl} from 'app/utils';
import {Theme} from 'app/utils/theme';

type Props = {
  data: Mechanism;
};

class ExceptionMechanism extends React.Component<Props> {
  render() {
    const mechanism = this.props.data;
    const {type, description, help_link, handled, meta = {}, data = {}} = mechanism;
    const {errno, signal, mach_exception} = meta;

    const linkElement = help_link && isUrl(help_link) && (
      <StyledExternalLink href={help_link}>
        <IconOpen size="xs" />
      </StyledExternalLink>
    );

    const descriptionElement = description && (
      <Hovercard
        header={
          <span>
            <Details>{t('Details')}</Details> {linkElement}
          </span>
        }
        body={description}
      >
        <StyledIconInfo size="14px" />
      </Hovercard>
    );

    const pills = [
      <Pill key="mechanism" name="mechanism" value={type || 'unknown'}>
        {descriptionElement || linkElement}
      </Pill>,
    ];

    if (!isNil(handled)) {
      pills.push(<Pill key="handled" name="handled" value={handled} />);
    }

    if (errno) {
      const value = errno.name || errno.number;
      pills.push(<Pill key="errno" name="errno" value={value} />);
    }

    if (mach_exception) {
      const value = mach_exception.name || mach_exception.exception;
      pills.push(<Pill key="mach" name="mach exception" value={value} />);
    }

    if (signal) {
      const code = signal.code_name || `${t('code')} ${signal.code}`;
      const name = signal.name || signal.number;
      const value = isNil(signal.code) ? name : `${name} (${code})`;
      pills.push(<Pill key="signal" name="signal" value={value} />);
    }

    forOwn(data, (value, key) => {
      if (!isObject(value)) {
        pills.push(<Pill key={`data:${key}`} name={key} value={value} />);
      }
    });

    return (
      <Wrapper>
        <Pills>{pills}</Pills>
      </Wrapper>
    );
  }
}

export default ExceptionMechanism;

const Wrapper = styled('div')`
  margin: ${space(2)} 0;
`;

const iconStyle = (p: {theme: Theme}) => css`
  transition: 0.1s linear color;
  color: ${p.theme.gray300};
  :hover {
    color: ${p.theme.gray500};
  }
`;

const StyledExternalLink = styled(ExternalLink)`
  display: inline-flex !important;
  ${iconStyle};
`;

const Details = styled('span')`
  margin-right: ${space(1)};
`;

const StyledIconInfo = styled(IconInfo)`
  display: flex;
  ${iconStyle};
`;
