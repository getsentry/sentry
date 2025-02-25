import {useEffect, useRef} from 'react';
import styled from '@emotion/styled';
import omit from 'lodash/omit';
import Prism from 'prismjs';

import {Alert} from 'sentry/components/core/alert/alert';
import KeyValueList from 'sentry/components/events/interfaces/keyValueList';
import List from 'sentry/components/list';
import {t, tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {EntryRequestDataGraphQl, Event} from 'sentry/types/event';
import {defined} from 'sentry/utils';
import {uniq} from 'sentry/utils/array/uniq';
import {loadPrismLanguage} from 'sentry/utils/prism';

type GraphQlBodyProps = {data: EntryRequestDataGraphQl['data']; event: Event};

type GraphQlError = {
  locations?: Array<{column: number; line: number}>;
  message?: string;
  path?: string[];
};

function getGraphQlErrorsFromResponseContext(event: Event): GraphQlError[] {
  const responseData = event.contexts?.response?.data;

  if (
    responseData &&
    typeof responseData === 'object' &&
    'errors' in responseData &&
    Array.isArray(responseData.errors) &&
    responseData.errors.every((error: any) => typeof error === 'object')
  ) {
    return responseData.errors;
  }

  return [];
}

function getErrorLineNumbers(errors: GraphQlError[]): number[] {
  return uniq(
    errors.flatMap(
      error =>
        error.locations?.map(loc => loc?.line).filter(line => typeof line === 'number') ??
        []
    )
  );
}

function formatErrorAlertMessage(error: GraphQlError) {
  const {locations, message} = error;

  if (!locations || locations.length === 0) {
    return message;
  }

  const prefix = locations
    .filter(loc => defined(loc.line) && defined(loc.column))
    .map(loc => t('Line %s Column %s', loc.line, loc.column))
    .join(', ');

  return `${prefix}: ${message}`;
}

function ErrorsAlert({errors}: {errors: GraphQlError[]}) {
  const errorsWithMessage = errors.filter(
    error => error.message && error.message.length > 0
  );

  if (errorsWithMessage.length === 0) {
    return null;
  }

  return (
    <Alert.Container>
      <StyledAlert
        type="error"
        showIcon
        expand={
          <List symbol="bullet">
            {errorsWithMessage.map((error, i) => (
              <li key={i}>{formatErrorAlertMessage(error)}</li>
            ))}
          </List>
        }
      >
        {tn(
          'There was %s GraphQL error raised during this request.',
          'There were %s errors raised during this request.',
          errorsWithMessage.length
        )}
      </StyledAlert>
    </Alert.Container>
  );
}

export function GraphQlRequestBody({data, event}: GraphQlBodyProps) {
  const ref = useRef<HTMLElement | null>(null);

  // https://prismjs.com/plugins/line-highlight/
  useEffect(() => {
    // @ts-expect-error TS(7016): Could not find a declaration file for module 'pris... Remove this comment to see the full error message
    import('prismjs/plugins/line-highlight/prism-line-highlight');
  }, []);

  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }

    if ('graphql' in Prism.languages) {
      Prism.highlightElement(element);
      return;
    }

    loadPrismLanguage('graphql', {onLoad: () => Prism.highlightElement(element)});
  }, []);

  const errors = getGraphQlErrorsFromResponseContext(event);
  const erroredLines = getErrorLineNumbers(errors);

  return (
    <div>
      <pre className="language-graphql" data-line={erroredLines.join(',')}>
        <code className="language-graphql" ref={ref}>
          {data.query}
        </code>
      </pre>
      <ErrorsAlert errors={errors} />
      <KeyValueList
        data={Object.entries(omit(data, 'query')).map(([key, value]) => ({
          key,
          subject: key,
          value: value as React.ReactNode,
        }))}
        isContextData
      />
    </div>
  );
}

const StyledAlert = styled(Alert)`
  margin-top: -${space(1)};
`;
