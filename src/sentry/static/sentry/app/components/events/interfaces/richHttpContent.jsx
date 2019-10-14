import PropTypes from 'prop-types';
import React from 'react';

import {objectIsEmpty} from 'app/utils';
import {objectToSortedTupleArray} from 'app/components/events/interfaces/utils';
import {t} from 'app/locale';
import ClippedBox from 'app/components/clippedBox';
import ContextData from 'app/components/contextData';
import ErrorBoundary from 'app/components/errorBoundary';
import KeyValueList from 'app/components/events/interfaces/keyValueList';
import AnnotatedText from 'app/components/events/meta/annotatedText';
import MetaData from 'app/components/events/meta/metaData';

class RichHttpContent extends React.Component {
  static propTypes = {
    data: PropTypes.object.isRequired,
  };

  getBodySection = (data, value, meta) => {
    // The http interface provides an inferred content type for the data body.
    if (meta && (!value || value instanceof String)) {
      // TODO(markus): Currently annotated nested objects are shown without
      // annotations.
      return (
        <pre>
          <AnnotatedText
            value={value}
            chunks={meta.chunks}
            remarks={meta.rem}
            errors={meta.err}
          />
        </pre>
      );
    } else if (value) {
      switch (data.inferredContentType) {
        case 'application/json':
          return <ContextData data={value} preserveQuotes />;
        case 'application/x-www-form-urlencoded':
        case 'multipart/form-data':
          return <KeyValueList data={objectToSortedTupleArray(value)} isContextData />;
        default:
          return <pre>{JSON.stringify(value, null, 2)}</pre>;
      }
    } else {
      return null;
    }
  };

  getQueryStringOrRaw = data => {
    try {
      // Sentry API abbreviates long query string values, sometimes resulting in
      // an un-parsable querystring ... stay safe kids
      return <KeyValueList data={data} isContextData />;
    } catch (e) {
      return <pre>{data}</pre>;
    }
  };

  render() {
    const data = this.props.data;
    return (
      <div>
        {!objectIsEmpty(data.query) && (
          <ClippedBox title={t('Query String')}>
            <ErrorBoundary mini>{this.getQueryStringOrRaw(data.query)}</ErrorBoundary>
          </ClippedBox>
        )}
        {data.fragment && (
          <ClippedBox title={t('Fragment')}>
            <ErrorBoundary mini>
              <pre>{data.fragment}</pre>
            </ErrorBoundary>
          </ClippedBox>
        )}

        <MetaData object={data} prop="data">
          {(value, meta) => {
            if (value || meta) {
              return (
                <ClippedBox title={t('Body')}>
                  {this.getBodySection(data, value, meta)}
                </ClippedBox>
              );
            }

            return null;
          }}
        </MetaData>

        {data.cookies && !objectIsEmpty(data.cookies) && (
          <ClippedBox title={t('Cookies')} defaultCollapsed>
            <ErrorBoundary mini>
              <KeyValueList data={data.cookies} />
            </ErrorBoundary>
          </ClippedBox>
        )}
        {!objectIsEmpty(data.headers) && (
          <ClippedBox title={t('Headers')}>
            <ErrorBoundary mini>
              <KeyValueList data={data.headers} />
            </ErrorBoundary>
          </ClippedBox>
        )}
        {!objectIsEmpty(data.env) && (
          <ClippedBox title={t('Environment')} defaultCollapsed>
            <ErrorBoundary mini>
              <KeyValueList data={objectToSortedTupleArray(data.env)} />
            </ErrorBoundary>
          </ClippedBox>
        )}
      </div>
    );
  }
}

export default RichHttpContent;
