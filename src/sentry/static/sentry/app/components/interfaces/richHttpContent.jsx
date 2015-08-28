import React from "react";

import ClippedBox from "../../components/clippedBox";
import DefinitionList from "./definitionList";
import ContextData from "../contextData";

import {objectIsEmpty} from "../../utils";
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
      case 'application/json':
        try {
          // Sentry API abbreviates long JSON strings, which cannot be parsed ...
          return <ContextData data={JSON.parse(data.data)} />;
        } catch (e) { /* do nothing */ }
        return <pre>{data.data}</pre>
      case 'application/x-www-form-urlencoded':
        return <DefinitionList data={this.objectToTupleArray(queryString.parse(data.data))}/>
      default:
        return <pre>{data.data}</pre>;
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
