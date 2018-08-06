import PropTypes from 'prop-types';
import React from 'react';
import queryString from 'query-string';

import {objectIsEmpty} from 'app/utils';
import {objectToSortedTupleArray} from 'app/components/events/interfaces/utils';
import {t} from 'app/locale';
import ClippedBox from 'app/components/clippedBox';
import ContextData from 'app/components/contextData';
import ErrorBoundary from 'app/components/errorBoundary';
import KeyValueList from 'app/components/events/interfaces/keyValueList';

class RichHttpContent extends React.Component {
  static propTypes = {
    data: PropTypes.object.isRequired,
  };

  getBodySection = data => {
    // The http interface provides an inferred content type for the data body.
    switch (data.inferredContentType) {
      case 'application/json':
        return <ContextData data={data.data} />;
      case 'application/x-www-form-urlencoded':
        return (
          <KeyValueList data={objectToSortedTupleArray(data.data)} isContextData={true} />
        );
      default:
        return <pre>{JSON.stringify(data.data, null, 2)}</pre>;
    }
  };

  getQueryStringOrRaw = data => {
    try {
      // Sentry API abbreviates long query string values, sometimes resulting in
      // an un-parsable querystring ... stay safe kids
      return (
        <KeyValueList
          data={objectToSortedTupleArray(queryString.parse(data))}
          isContextData={true}
        />
      );
    } catch (e) {
      return <pre>{data}</pre>;
    }
  };

  render() {
    let data = this.props.data;
    return (
      <div>
        {data.query && (
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

        {data.data && (
          <ClippedBox title={t('Body')}>
            <ErrorBoundary mini>{this.getBodySection(data)}</ErrorBoundary>
          </ClippedBox>
        )}

        {data.cookies &&
          !objectIsEmpty(data.cookies) && (
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
