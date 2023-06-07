import {useEffect, useRef} from 'react';
import omit from 'lodash/omit';
import uniq from 'lodash/uniq';
import Prism from 'prismjs';

import KeyValueList from 'sentry/components/events/interfaces/keyValueList';
import {EntryRequestDataGraphQl, Event} from 'sentry/types';
import {loadPrismLanguage} from 'sentry/utils/loadPrismLanguage';

type GraphQlBodyProps = {data: EntryRequestDataGraphQl['data']; event: Event};

type GraphQlErrors = Array<{
  locations?: Array<{column: number; line: number}>;
  message?: string;
  path?: string[];
}>;

function getGraphQlErrorsFromResponseContext(event: Event): GraphQlErrors {
  const responseData = event.contexts?.response?.data;

  if (
    responseData &&
    typeof responseData === 'object' &&
    'errors' in responseData &&
    Array.isArray(responseData.errors)
  ) {
    return responseData.errors;
  }

  return [];
}

function getErrorLineNumbers(errors: GraphQlErrors): number[] {
  return uniq(
    errors.flatMap(
      error =>
        error.locations?.map(loc => loc.line).filter(line => typeof line === 'number') ??
        []
    )
  );
}

export function GraphQlRequestBody({data, event}: GraphQlBodyProps) {
  const ref = useRef<HTMLElement | null>(null);

  // https://prismjs.com/plugins/line-highlight/
  useEffect(() => {
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
      <KeyValueList
        data={Object.entries(omit(data, 'query')).map(([key, value]) => ({
          key,
          subject: key,
          value,
        }))}
        isContextData
      />
    </div>
  );
}
