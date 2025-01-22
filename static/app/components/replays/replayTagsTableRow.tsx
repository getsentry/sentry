import type {ReactNode} from 'react';
import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';
import type {LocationDescriptor} from 'history';

import {AnnotatedText} from 'sentry/components/events/meta/annotatedText';
import {KeyValueTableRow} from 'sentry/components/keyValueTable';
import Link from 'sentry/components/links/link';
import {CollapsibleValue} from 'sentry/components/structuredEventData/collapsibleValue';
import {Tooltip} from 'sentry/components/tooltip';
import Version from 'sentry/components/version';
import {space} from 'sentry/styles/space';

interface Props {
  name: string;
  values: ReactNode[];
  generateUrl?: (name: string, value: ReactNode) => LocationDescriptor;
}

const expandedViewKeys = [
  'sdk.replay.maskedViewClasses',
  'sdk.replay.unmaskedViewClasses',
];

function renderValueList(values: ReactNode[]) {
  if (typeof values[0] === 'string') {
    return values[0];
  }
  const valueItems = values[0] as string[];

  if (!valueItems.length) {
    return undefined;
  }

  return valueItems.map((value, index) => (
    <Fragment key={`${index}-${value}`}>
      {value}
      <br />
    </Fragment>
  ));
}

function ReplayTagsTableRow({name, values, generateUrl}: Props) {
  const renderTagValue = useMemo(() => {
    if (name === 'release') {
      return values.map((value, index) => (
        <Fragment key={`${name}-${index}-${value}`}>
          {index > 0 && ', '}
          <Version key={index} version={String(value)} anchor={false} withPackage />
        </Fragment>
      ));
    }
    if (
      expandedViewKeys.includes(name) &&
      renderValueList(values) &&
      typeof renderValueList(values) !== 'string'
    ) {
      return (
        <CollapsibleValue openTag="[" closeTag="]" path="$" noBasePadding>
          {renderValueList(values)}
        </CollapsibleValue>
      );
    }

    return values.map((value, index) => {
      const target = generateUrl?.(name, value);

      return (
        <Fragment key={`${name}-${index}-${value}`}>
          {index > 0 && ', '}
          {target ? <Link to={target}>{value}</Link> : <AnnotatedText value={value} />}
        </Fragment>
      );
    });
  }, [name, values, generateUrl]);

  return (
    <KeyValueTableRow
      keyName={
        <StyledTooltip title={name} showOnlyOnOverflow>
          {name}
        </StyledTooltip>
      }
      value={
        <ValueContainer>
          <StyledTooltip
            overlayStyle={
              expandedViewKeys.includes(name) ? {textAlign: 'left'} : undefined
            }
            title={
              expandedViewKeys.includes(name) ? renderValueList(values) : renderTagValue
            }
            isHoverable
            showOnlyOnOverflow
          >
            {renderTagValue}
          </StyledTooltip>
        </ValueContainer>
      }
    />
  );
}

export default ReplayTagsTableRow;

const ValueContainer = styled('div')`
  span {
    font-size: ${p => p.theme.fontSizeMedium};
  }
  display: flex;
  padding: ${space(0.25)};
  justify-content: flex-end;
`;

const StyledTooltip = styled(Tooltip)`
  ${p => p.theme.overflowEllipsis};
`;
