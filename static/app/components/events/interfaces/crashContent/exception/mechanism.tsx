import {css, Theme} from '@emotion/react';
import styled from '@emotion/styled';
import forOwn from 'lodash/forOwn';
import isNil from 'lodash/isNil';
import isObject from 'lodash/isObject';

import {AnnotatedText} from 'sentry/components/events/meta/annotatedText';
import {Hovercard} from 'sentry/components/hovercard';
import ExternalLink from 'sentry/components/links/externalLink';
import Pill from 'sentry/components/pill';
import Pills from 'sentry/components/pills';
import {IconOpen} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {StackTraceMechanism} from 'sentry/types/stacktrace';
import {isUrl} from 'sentry/utils';

type Props = {
  data: StackTraceMechanism;
  meta?: Record<any, any>;
};

export function Mechanism({data: mechanism, meta: mechanismMeta}: Props) {
  const {type, description, help_link, handled, source, meta = {}, data = {}} = mechanism;

  const {errno, signal, mach_exception} = meta;

  const linkElement = help_link && isUrl(help_link) && (
    <StyledExternalLink href={help_link}>
      <IconOpen size="xs" />
    </StyledExternalLink>
  );

  const typeName = type || 'unknown';

  const pills = [
    <Pill key="mechanism" name="mechanism">
      {description ? (
        <Hovercard
          showUnderline
          header={
            <Details>
              {t('Details')}
              {linkElement}
            </Details>
          }
          body={description}
        >
          {typeName}
        </Hovercard>
      ) : linkElement ? (
        <Name>
          {typeName}
          {linkElement}
        </Name>
      ) : (
        typeName
      )}
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

  if (source) {
    pills.push(<Pill key="source" name="source" value={source} />);
  }

  if (signal) {
    const code = signal.code_name || `${t('code')} ${signal.code}`;
    const name = signal.name || signal.number;
    const value = isNil(signal.code) ? name : `${name} (${code})`;
    pills.push(<Pill key="signal" name="signal" value={value} />);
  }

  forOwn(data, (value, key) => {
    if (!isObject(value)) {
      pills.push(
        <Pill key={`data:${key}`} name={key}>
          {mechanismMeta?.data?.[key]?.[''] && !value ? (
            <AnnotatedText value={value} meta={mechanismMeta?.data?.[key]?.['']} />
          ) : (
            value
          )}
        </Pill>
      );
    }
  });

  return (
    <Wrapper>
      <StyledPills>{pills}</StyledPills>
    </Wrapper>
  );
}

const Wrapper = styled('div')`
  margin: ${space(2)} 0 ${space(0.5)} 0;
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

const Name = styled('span')`
  display: grid;
  grid-template-columns: max-content max-content;
  gap: ${space(0.5)};
  align-items: center;
`;

const Details = styled(Name)`
  gap: ${space(1)};
`;

const StyledPills = styled(Pills)`
  span:nth-of-type(2) {
    display: inline;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
`;
