import React from 'react';
import PropTypes from 'prop-types';
import queryString from 'query-string';

import ClippedBox from '../../clippedBox';
import KeyValueList from './keyValueList';
import ContextData from '../../contextData';

import {objectToSortedTupleArray} from './utils';
import {objectIsEmpty} from '../../../utils';
import {t} from '../../../locale';

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
            {this.getQueryStringOrRaw(data.query)}
          </ClippedBox>
        )}
        {data.fragment && (
          <ClippedBox title={t('Fragment')}>
            <pre>{data.fragment}</pre>
          </ClippedBox>
        )}

        {data.data && (
          <ClippedBox title={t('Body')}>{this.getBodySection(data)}</ClippedBox>
        )}

        {data.cookies &&
          !objectIsEmpty(data.cookies) && (
            <ClippedBox title={t('Cookies')} defaultCollapsed>
              <KeyValueList data={data.cookies} />
            </ClippedBox>
          )}
        {!objectIsEmpty(data.headers) && (
          <ClippedBox title={t('Headers')}>
            <KeyValueList data={data.headers} />
          </ClippedBox>
        )}
        {!objectIsEmpty(data.env) && (
          <ClippedBox title={t('Environment')} defaultCollapsed>
            <KeyValueList data={objectToSortedTupleArray(data.env)} />
          </ClippedBox>
        )}
      </div>
    );
  }
}

export default RichHttpContent;
