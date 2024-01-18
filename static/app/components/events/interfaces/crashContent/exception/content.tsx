import {useState} from 'react';
import styled from '@emotion/styled';

import addIntegrationProvider from 'sentry-images/spot/add-integration-provider.svg';

import {Button, LinkButton} from 'sentry/components/button';
import {
  prepareSourceMapDebuggerFrameInformation,
  useSourceMapDebuggerData,
} from 'sentry/components/events/interfaces/crashContent/exception/useSourceMapDebuggerData';
import {renderLinksInText} from 'sentry/components/events/interfaces/crashContent/exception/utils';
import {getStacktracePlatform} from 'sentry/components/events/interfaces/utils';
import {AnnotatedText} from 'sentry/components/events/meta/annotatedText';
import {Tooltip} from 'sentry/components/tooltip';
import {IconClose} from 'sentry/icons';
import {t, tct, tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {ExceptionType, Project} from 'sentry/types';
import {Event, ExceptionValue} from 'sentry/types/event';
import {StackType} from 'sentry/types/stacktrace';
import {defined} from 'sentry/utils';

import {Mechanism} from './mechanism';
import {RelatedExceptions} from './relatedExceptions';
import StackTrace from './stackTrace';

type StackTraceProps = React.ComponentProps<typeof StackTrace>;

type Props = {
  event: Event;
  projectSlug: Project['slug'];
  type: StackType;
  meta?: Record<any, any>;
  newestFirst?: boolean;
  stackView?: StackTraceProps['stackView'];
  threadId?: number;
} & Pick<ExceptionType, 'values'> &
  Pick<
    React.ComponentProps<typeof StackTrace>,
    'groupingCurrentLevel' | 'hasHierarchicalGrouping'
  >;

type CollapsedExceptionMap = {[exceptionId: number]: boolean};

const useCollapsedExceptions = (values?: ExceptionValue[]) => {
  const [collapsedExceptions, setCollapsedSections] = useState<CollapsedExceptionMap>(
    () => {
      if (!values) {
        return {};
      }

      return values
        .filter(
          ({mechanism}) => mechanism?.is_exception_group && defined(mechanism.parent_id)
        )
        .reduce(
          (acc, next) => ({...acc, [next.mechanism?.exception_id ?? -1]: true}),
          {}
        );
    }
  );

  const toggleException = (exceptionId: number) => {
    setCollapsedSections(old => {
      if (!defined(old[exceptionId])) {
        return old;
      }

      return {...old, [exceptionId]: !old[exceptionId]};
    });
  };

  const expandException = (exceptionId: number) => {
    setCollapsedSections(old => {
      const exceptionValue = values?.find(
        value => value.mechanism?.exception_id === exceptionId
      );
      const exceptionGroupId = exceptionValue?.mechanism?.parent_id;

      if (!exceptionGroupId || !defined(old[exceptionGroupId])) {
        return old;
      }

      return {...old, [exceptionGroupId]: false};
    });
  };

  return {toggleException, collapsedExceptions, expandException};
};

function ToggleExceptionButton({
  values,
  exception,
  toggleException,
  collapsedExceptions,
}: {
  collapsedExceptions: CollapsedExceptionMap;
  exception: ExceptionValue;
  toggleException: (exceptionId: number) => void;
  values: ExceptionValue[];
}) {
  const exceptionId = exception.mechanism?.exception_id;

  if (!exceptionId || !defined(collapsedExceptions[exceptionId])) {
    return null;
  }

  const collapsed = collapsedExceptions[exceptionId];
  const numChildren = values.filter(
    ({mechanism}) => mechanism?.parent_id === exceptionId
  ).length;

  return (
    <ShowRelatedExceptionsButton
      priority="link"
      onClick={() => toggleException(exceptionId)}
    >
      {collapsed
        ? tn('Show %s related exceptions', 'Show %s related exceptions', numChildren)
        : tn('Hide %s related exceptions', 'Hide %s related exceptions', numChildren)}
    </ShowRelatedExceptionsButton>
  );
}

export function Content({
  newestFirst,
  event,
  stackView,
  groupingCurrentLevel,
  hasHierarchicalGrouping,
  projectSlug,
  values,
  type,
  meta,
  threadId,
}: Props) {
  const {collapsedExceptions, toggleException, expandException} =
    useCollapsedExceptions(values);

  const sourceMapDebuggerData = useSourceMapDebuggerData(event, projectSlug);

  // Organization context may be unavailable for the shared event view, so we
  // avoid using the `useOrganization` hook here and directly useContext
  // instead.
  if (!values) {
    return null;
  }

  const children = values.map((exc, excIdx) => {
    const id = defined(exc.mechanism?.exception_id)
      ? `exception-${exc.mechanism?.exception_id}`
      : undefined;

    const frameSourceMapDebuggerData = sourceMapDebuggerData?.exceptions[
      excIdx
    ].frames.map(debuggerFrame =>
      prepareSourceMapDebuggerFrameInformation(
        sourceMapDebuggerData,
        debuggerFrame,
        event
      )
    );
    const exceptionValue = exc.value
      ? renderLinksInText({exceptionText: exc.value})
      : null;

    if (exc.mechanism?.parent_id && collapsedExceptions[exc.mechanism.parent_id]) {
      return null;
    }

    const platform = getStacktracePlatform(event, exc.stacktrace);

    return (
      <div key={excIdx} className="exception" data-test-id="exception-value">
        {defined(exc?.module) ? (
          <Tooltip title={tct('from [exceptionModule]', {exceptionModule: exc?.module})}>
            <Title id={id}>{exc.type}</Title>
          </Tooltip>
        ) : (
          <Title id={id}>{exc.type}</Title>
        )}
        <StyledPre className="exc-message">
          {meta?.[excIdx]?.value?.[''] && !exc.value ? (
            <AnnotatedText value={exc.value} meta={meta?.[excIdx]?.value?.['']} />
          ) : (
            exceptionValue
          )}
        </StyledPre>
        <ToggleExceptionButton
          {...{collapsedExceptions, toggleException, values, exception: exc}}
        />
        {exc.mechanism && (
          <Mechanism data={exc.mechanism} meta={meta?.[excIdx]?.mechanism} />
        )}
        <RelatedExceptions
          mechanism={exc.mechanism}
          allExceptions={values}
          newestFirst={newestFirst}
          onExceptionClick={expandException}
        />
        <StacktraceIntegrationBannerWrapper>
          <div>
            <IntegationBannerTitle>
              {t('Connect with Git Providers')}
            </IntegationBannerTitle>
            <IntegationBannerDescription>
              {t(
                'Install Git providers (GitHub, Gitlab…) to enable features like code mapping and stack trace linking.'
              )}
            </IntegationBannerDescription>
            <LinkButton to="/settings/account/identities/">{t('Get Started')}</LinkButton>
          </div>
          <IntegrationBannerImage src={addIntegrationProvider} />
          <CloseButton
            borderless
            priority="link"
            aria-label={t('Close')}
            icon={<IconClose color="subText" />}
            size="xs"
          />
        </StacktraceIntegrationBannerWrapper>
        <StackTrace
          data={
            type === StackType.ORIGINAL
              ? exc.stacktrace
              : exc.rawStacktrace || exc.stacktrace
          }
          stackView={stackView}
          stacktrace={exc.stacktrace}
          expandFirstFrame={excIdx === values.length - 1}
          platform={platform}
          newestFirst={newestFirst}
          event={event}
          chainedException={values.length > 1}
          hasHierarchicalGrouping={hasHierarchicalGrouping}
          groupingCurrentLevel={groupingCurrentLevel}
          meta={meta?.[excIdx]?.stacktrace}
          threadId={threadId}
          frameSourceMapDebuggerData={frameSourceMapDebuggerData}
          stackType={type}
        />
      </div>
    );
  });

  if (newestFirst) {
    children.reverse();
  }

  return <div>{children}</div>;
}

const StyledPre = styled('pre')`
  margin-bottom: ${space(1)};
  margin-top: 0;
`;

const Title = styled('h5')`
  margin-bottom: ${space(0.5)};
  overflow-wrap: break-word;
  word-wrap: break-word;
  word-break: break-word;
`;

const ShowRelatedExceptionsButton = styled(Button)`
  font-family: ${p => p.theme.text.familyMono};
  font-size: ${p => p.theme.fontSizeSmall};
`;

const StacktraceIntegrationBannerWrapper = styled('div')`
  position: relative;
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  padding: ${space(2)};
  background: linear-gradient(
    90deg,
    ${p => p.theme.backgroundSecondary}00 0%,
    ${p => p.theme.backgroundSecondary}FF 70%,
    ${p => p.theme.backgroundSecondary}FF 100%
  );
`;

const IntegationBannerTitle = styled('div')`
  font-size: ${p => p.theme.fontSizeExtraLarge};
  margin-bottom: ${space(1)};
  font-weight: 600;
`;

const IntegationBannerDescription = styled('div')`
  margin-bottom: ${space(1)};
  max-width: 340px;
`;

const IntegrationBannerImage = styled('img')`
  position: absolute;
  display: block;
  bottom: 0px;
  right: 5rem;
  object-fit: cover;
  z-index: 1;
  pointer-events: none;
`;

const CloseButton = styled(Button)`
  position: absolute;
  display: block;
  top: ${space(2)};
  right: ${space(2)};
  color: ${p => p.theme.white};
  cursor: pointer;
  z-index: 1;
`;
