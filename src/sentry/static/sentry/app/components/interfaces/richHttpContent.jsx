import React from "react";
import ClippedBox from "../../components/clippedBox";
import DefinitionList from "./definitionList";

import {objectIsEmpty} from "../../utils";

var RichHttpContent = React.createClass({

  objectToTupleArray(obj) {
    return Object.keys(obj).map((k) => [k, obj[k]]);
  },

  render(){
    let data = this.props.data;

    return (
      <div>
        {data.query &&
          <ClippedBox title="Query String">
            <pre>{data.query}</pre>
          </ClippedBox>
        }
        {data.fragment &&
          <ClippedBox title="Fragment">
            <pre>{data.fragment}</pre>
          </ClippedBox>
        }
        {data.data &&
          <ClippedBox title="Body">
            <pre>{data.data}</pre>
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
