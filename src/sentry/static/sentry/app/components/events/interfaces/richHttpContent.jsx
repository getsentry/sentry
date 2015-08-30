import React from "react";

import ClippedBox from "../../clippedBox";
import DefinitionList from "./definitionList";
import ContextData from "../../contextData";

import {objectIsEmpty} from "../../../utils";
import queryString from "query-string";

var RichHttpContent = React.createClass({

  /**
   * Converts an object of body/querystring key/value pairs
   * into a tuple of [key, value] pairs.
   *
   * Note that the query-string parser returns dupes like this:
   *   { foo: ['bar', 'baz'] } // ?foo=bar&bar=baz
   *
   * This method accounts for this.
   */
  objectToTupleArray(obj) {
    return Object.keys(obj).reduce((out, k) => {
      let val = obj[k];
      return out.concat(
        {}.toString.call(val) === '[object Array]' ?
          val.map(v => [k, v]) : // key has multiple values (array)
          [[k, val]]             // key has single value
      );
    }, []);
  },

  getBodySection(data) {
    let contentType = data.headers.find(h => h[0] === 'Content-Type');
    contentType = contentType && contentType[1];

    switch (contentType) {
      case 'application/x-www-form-urlencoded':
        return this.getQueryStringOrRaw(data.data);
      case 'application/json':
        // falls through
      default:
        // Even if Content-Type isn't JSON, attempt to serialize it as JSON
        // anyways. Many HTTP requests contains JSON bodies, despite not having
        // matching Content-Type.
        return this.getJsonOrRaw(data.data);
    }
  },

  getQueryStringOrRaw(data) {
    try {
      // Sentry API abbreviates long query stirng values, sometimes resulting in
      // an un-parsable querystring ... stay safe kids
      return <DefinitionList data={this.objectToTupleArray(queryString.parse(data))}/>
    } catch (e) {
      return <pre>{data}</pre>
    }
  },

  getJsonOrRaw(data) {
    try {
      // Sentry API abbreviates long JSON strings, resulting in an un-parsable
      // JSON string ... stay safe kids
      return <ContextData data={JSON.parse(data)} />;
    } catch (e) {
      return <pre>{data}</pre>
    }
  },

  render(){
    let data = this.props.data;

    return (
      <div>
        {data.query &&
          <ClippedBox title="Query String">
            <DefinitionList data={this.objectToTupleArray(queryString.parse(data.query))}/>
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
            <DefinitionList data={data.cookies} />
          </ClippedBox>
        }
        {!objectIsEmpty(data.headers) &&
          <ClippedBox title="Headers">
            <DefinitionList data={data.headers} />
          </ClippedBox>
        }
        {!objectIsEmpty(data.env) &&
          <ClippedBox title="Environment" defaultCollapsed>
            <DefinitionList data={this.objectToTupleArray(data.env)}/>
          </ClippedBox>
        }
      </div>
    );
  }
});

export default RichHttpContent;
