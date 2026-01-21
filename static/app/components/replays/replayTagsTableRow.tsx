import type {ReactNode} from 'react';
import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';
import type {LocationDescriptor} from 'history';

import {Link} from 'sentry/components/core/link';
import {Tooltip} from 'sentry/components/core/tooltip';
import ErrorBoundary from 'sentry/components/errorBoundary';
import {AnnotatedText} from 'sentry/components/events/meta/annotatedText';
import {KeyValueTableRow} from 'sentry/components/keyValueTable';
import ReleaseDropdownFilter from 'sentry/components/replays/releaseDropdownFilter';
import {CollapsibleValue} from 'sentry/components/structuredEventData/collapsibleValue';
import Version from 'sentry/components/version';
import {space} from 'sentry/styles/space';
import useOrganization from 'sentry/utils/useOrganization';
import {QuickContextHoverWrapper} from 'sentry/views/discover/table/quickContext/quickContextWrapper';
import {ContextType} from 'sentry/views/discover/table/quickContext/utils';

interface Props {
  name: string;
  values: string[];
  generateUrl?: (name: string, value: string) => LocationDescriptor;
}

const expandedViewKeys = [
  // Java, Cocoa, React Native
  'sdk.replay.maskedViewClasses',
  'sdk.replay.unmaskedViewClasses',
  // Flutter
  'sdk.replay.maskingRules',

  // Network request/response
  'sdk.replay.networkDetailAllowUrls',
  'sdk.replay.networkDetailDenyUrls',
  'sdk.replay.networkRequestHeaders',
  'sdk.replay.networkResponseHeaders',
];

const releaseKeys = ['release', 'releases'];

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
  const organization = useOrganization();

  const renderTagValue = useMemo(() => {
    if (releaseKeys.includes(name)) {
      return values.map((value, index) => (
        <Fragment key={`${name}-${index}-${value}`}>
          {index > 0 && ', '}
          <StyledVersionContainer>
            <ReleaseDropdownFilter version={String(value)} />
            <QuickContextHoverWrapper
              dataRow={{release: String(value)}}
              contextType={ContextType.RELEASE}
              organization={organization}
            >
              <Version
                key={index}
                version={String(value)}
                truncate={false}
                anchor={false}
              />
            </QuickContextHoverWrapper>
          </StyledVersionContainer>
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
  }, [name, values, generateUrl, organization]);

  return (
    <KeyValueTableRow
      keyName={
        <StyledTooltip title={name} showOnlyOnOverflow>
          {name}
        </StyledTooltip>
      }
      value={
        <ErrorBoundary mini>
          <ValueContainer>
            <StyledTooltip
              disabled={releaseKeys.includes(name)}
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
        </ErrorBoundary>
      }
    />
  );
}

export default ReplayTagsTableRow;

const ValueContainer = styled('div')`
  span {
    font-size: ${p => p.theme.fontSize.md};
  }
  display: flex;
  padding: ${space(0.25)};
  justify-content: flex-end;
`;

const StyledTooltip = styled(Tooltip)`
  display: block;
  width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const StyledVersionContainer = styled('div')`
  display: flex;
  justify-content: flex-end;
  gap: ${space(0.75)};

  .invisible-button {
    visibility: hidden;
  }

  &:hover {
    .invisible-button {
      visibility: visible;
    }
  }
`;
