import React from 'react';

import ClippedBox from '../../clippedBox';
import KeyValueList from './keyValueList';
import ContextData from '../../contextData';

import {objectIsEmpty} from '../../../utils';
import queryString from 'query-string';

const RichHttpContent = React.createClass({

  /**
   * Converts an object of body/querystring key/value pairs
   * into a tuple of [key, value] pairs, and sorts them.
   *
   * Note that the query-string parser returns dupes like this:
   *   { foo: ['bar', 'baz'] } // ?foo=bar&bar=baz
   *
   * This method accounts for this.
   */
  objectToSortedTupleArray(obj) {
    return Object.keys(obj).reduce((out, k) => {
      let val = obj[k];
      return out.concat(
        {}.toString.call(val) === '[object Array]' ?
          val.map(v => [k, v]) : // key has multiple values (array)
          [[k, val]]             // key has single value
      );
    }, []).sort(function ([keyA], [keyB]) {
      return keyA < keyB ? -1 : 1;
    });
  },

  getBodySection(data) {
    /*eslint no-empty:0*/
    let contentType = data.headers.find(h => h[0] === 'Content-Type');
    contentType = contentType && contentType[1].split(';')[0].toLowerCase();

    // Ignoring Content-Type, we immediately just check if the body is parseable
    // as JSON. Why? Because many applications don't set proper Content-Type values,
    // e.g. x-www-form-urlencoded  actually contains JSON.
    try {
      return <ContextData data={JSON.parse(data.data)} />;
    } catch (e) {}

    if (contentType === 'application/x-www-form-urlencoded') {
      return this.getQueryStringOrRaw(data.data);
    } else {
      return <pre>{data.data}</pre>;
    }
  },

  getQueryStringOrRaw(data) {
    try {
      // Sentry API abbreviates long query string values, sometimes resulting in
      // an un-parsable querystring ... stay safe kids
      return <KeyValueList data={this.objectToSortedTupleArray(queryString.parse(data))}/>;
    } catch (e) {
      return <pre>{data}</pre>;
    }
  },

  render(){
    let data = this.props.data;
    return (
      <div>
        {data.query &&
          <ClippedBox title="Query String">
            {this.getQueryStringOrRaw(data.query)}
          </ClippedBox>
        }
        {data.fragment &&
          <ClippedBox title="Fragment">
            <pre>{data.fragment}</pre>
          </ClippedBox>
        }

        {data.data &&
          <ClippedBox title="Body">
            {this.getBodySection(data)}
          </ClippedBox>
        }

        {data.cookies && !objectIsEmpty(data.cookies) &&
          <ClippedBox title="Cookies" defaultCollapsed>
            <KeyValueList data={data.cookies} />
          </ClippedBox>
        }
        {!objectIsEmpty(data.headers) &&
          <ClippedBox title="Headers">
            <KeyValueList data={data.headers} />
          </ClippedBox>
        }
        {!objectIsEmpty(data.env) &&
          <ClippedBox title="Environment" defaultCollapsed>
            <KeyValueList data={this.objectToSortedTupleArray(data.env)}/>
          </ClippedBox>
        }
      </div>
    );
  }
});

export default RichHttpContent;
